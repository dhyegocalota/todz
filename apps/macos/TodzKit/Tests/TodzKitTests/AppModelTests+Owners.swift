import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let firstTask = TaskKey(projectIdentifier: inboxIdentifier, number: 1)
private let secondTask = TaskKey(projectIdentifier: inboxIdentifier, number: 2)
private let cachedOwnerIdentifier = "cached-owner"

enum CachedOwner: CaseIterable, Sendable {
    case another
    case missing
    case unreadable
}

extension AppModelTests {
    @MainActor private func harnessWithAWaitingChange() throws -> AppModelHarness {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 2)
        harness.cache([acme], active: acme)
        harness.cacheTasks(projectIdentifier: inboxIdentifier, count: 2, cursor: 2)
        try harness.store.keep(Outbox().appending(.field(firstTask, .title("Waiting")), isHeadSent: false))
        return harness
    }

    @Test(arguments: CachedOwner.allCases)
    func aSignInNotAsTheCachesOwnerErasesTheCacheBeforeTheSessionIsStored(cachedOwner: CachedOwner) async throws {
        let harness = try harnessWithAWaitingChange()
        switch cachedOwner {
        case .another: harness.store.owner = OwnerCache(ownerIdentifier: "someone-else", workspaces: [], activeWorkspaceIdentifier: nil)
        case .missing: harness.store.owner = nil
        case .unreadable: harness.store.failures[.readOwner] = .unreadable
        }
        await harness.model.launch()
        #expect(harness.model.waitingChangeCount == 1)
        let isUntouchedAtErase = Captured<Bool>()
        harness.store.onCall = { call in
            guard call == .erase else { return }
            let isMemoryEmpty = harness.model.outbox == Outbox() && harness.model.board == TaskBoard() && harness.model.workspaces.isEmpty
            isUntouchedAtErase.value = isMemoryEmpty && harness.vault.secret == nil && harness.service.routes() == [.signIn]
        }
        await harness.model.signIn(identity: "dhyego")
        #expect(isUntouchedAtErase.value == true)
        #expect(harness.vault.secret == harness.service.issuedSession.sessionToken)
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.service.routes().contains(.updateTask) == false)
        #expect(harness.model.taskViews?.inbox.map(\.task.title) == ["Task 1", "Task 2"])
        #expect(harness.store.owner?.ownerIdentifier == harness.ownerIdentifier)
    }

    @Test func aSignInAfterASessionEndedAsAnotherOwnerEmptiesTheWindowAndItsWatches() async throws {
        let harness = try harnessWithAWaitingChange()
        harness.service.failures[.updateTask] = .unreachable
        await harness.launchedFromCache()
        harness.service.failures[.readChanges] = .unauthorized
        await harness.model.refresh()
        #expect(harness.model.phase == .signedOut(notice: .sessionEnded))
        harness.service.failures = [:]
        harness.service.issuedSession = IssuedSession(
            sessionToken: UUID().uuidString,
            owner: Owner(identifier: "another-owner", timeZone: harnessTimeZoneIdentifier)
        )
        await harness.model.signIn(identity: "walker-2")
        #expect(harness.store.routes().contains(.erase))
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.store.owner?.ownerIdentifier == "another-owner")
        await harness.signals.cancelled(harness.watchKey(inboxIdentifier))
    }

    @Test func aSignInWhoseEraseFailsFailsSignsTheIssuedSessionOutAndLeavesTheVaultUntouched() async throws {
        let harness = try harnessWithAWaitingChange()
        harness.store.owner = nil
        harness.store.failures[.erase] = .unwritable
        await harness.model.launch()
        await harness.model.signIn(identity: "dhyego")
        #expect(harness.model.signInError == .unexpected)
        #expect(harness.model.session == nil)
        #expect(harness.model.phase == .signedOut(notice: nil))
        #expect(harness.vault.secret == nil)
        #expect(harness.vault.eraseCount == 0)
        #expect(harness.service.calls.dropFirst() == [.signOut(session: harness.service.issuedSession.sessionToken)])
    }

    @Test func aSignInAsTheCachesOwnerReopensTheCachedWindowThenPulls() async throws {
        let harness = try harnessWithAWaitingChange()
        await harness.model.launch()
        harness.service.suspend(.listWorkspaces)
        let signingIn = Task { await harness.model.signIn(identity: "dhyego") }
        await harness.service.held(.listWorkspaces)
        #expect(harness.model.phase == .ready)
        #expect(harness.model.taskViews?.inbox.map(\.task.title) == ["Waiting", "Cached 2"])
        #expect(harness.signals.opens == [WatchKey(session: harness.service.issuedSession.sessionToken, projectIdentifier: inboxIdentifier)])
        harness.service.resume(.listWorkspaces)
        await signingIn.value
        let session = harness.service.issuedSession.sessionToken
        #expect(harness.service.calls.contains(.readChanges(session: session, projectIdentifier: inboxIdentifier, cursor: 2)))
        #expect(harness.store.routes().contains(.erase) == false)
    }

    @Test func signOutErasesTheCacheThenCancelsTheWatchesThenErasesTheVaultThenSignsOut() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 1)
        await harness.signedIn()
        harness.store.calls = []
        let vaultErasesAtStoreErase = Captured<Int>()
        let isWatchingAtVaultErase = Captured<Bool>()
        let isStoreErasedAtVaultErase = Captured<Bool>()
        let vaultErasesAtSignOut = Captured<Int>()
        harness.store.onCall = { call in
            guard call == .erase else { return }
            vaultErasesAtStoreErase.value = harness.vault.eraseCount
        }
        harness.vault.onErase = {
            isWatchingAtVaultErase.value = !harness.model.watches.isEmpty
            isStoreErasedAtVaultErase.value = harness.store.routes().contains(.erase)
        }
        harness.service.onCall = { call in
            guard call.route == .signOut else { return }
            vaultErasesAtSignOut.value = harness.vault.eraseCount
        }
        await harness.model.signOut()
        #expect(harness.store.routes() == [.erase])
        #expect(vaultErasesAtStoreErase.value == 0)
        #expect(isWatchingAtVaultErase.value == false)
        #expect(isStoreErasedAtVaultErase.value == true)
        #expect(vaultErasesAtSignOut.value == 1)
        #expect(harness.service.calls == [.signOut(session: harness.session)])
        await harness.signals.cancelled(harness.watchKey(inboxIdentifier))
    }

    @Test func aSignOutWhoseEraseFailsStaysSignedInWithTheVaultAndSaysSo() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 1)
        await harness.signedIn()
        harness.store.failures[.erase] = .unwritable
        await harness.model.signOut()
        #expect(harness.model.banner == .signOutFailed)
        #expect(harness.model.phase == .ready)
        #expect(harness.model.session == harness.session)
        #expect(harness.model.taskViews?.inbox.map(\.task.number) == [1])
        #expect(harness.vault.secret == harness.session)
        #expect(harness.vault.eraseCount == 0)
        #expect(harness.service.calls == [])
        #expect(harness.model.watches.keys.contains(inboxIdentifier))
    }

    @Test func aPullAnsweredAfterASignOutWritesNothing() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 1)
        await harness.signedIn()
        harness.service.suspend(.readChanges)
        let refreshing = Task { await harness.model.refresh() }
        await harness.service.held(.readChanges)
        await harness.model.signOut()
        harness.store.calls = []
        harness.service.resume(.readChanges)
        await refreshing.value
        #expect(harness.store.calls == [])
        #expect(harness.store.owner == nil)
        #expect(harness.store.projects == [:])
    }

    @Test func aLaunchSendsNothingBeforeTheSessionsOwnerIsConfirmedThenErasesAnotherOwnersCache() async throws {
        let harness = try harnessWithAWaitingChange()
        let acme = try #require(harness.service.workspaces.first)
        harness.cache([acme], active: acme, ownerIdentifier: cachedOwnerIdentifier)
        harness.vault.secret = harness.session
        harness.service.suspend(.updateOwner)
        harness.service.suspend(.readChanges)
        let launching = Task { await harness.model.launch() }
        await harness.service.held(.updateOwner)
        harness.signals.send(.opened, to: harness.watchKey(inboxIdentifier))
        await harness.service.held(.readChanges)
        await harness.flushed()
        #expect(harness.service.routes().contains(.updateTask) == false)
        harness.service.unsuspend(.readChanges)
        harness.service.resume(.readChanges)
        harness.service.resume(.updateOwner)
        await launching.value
        await harness.flushed()
        #expect(harness.service.routes().contains(.updateTask) == false)
        #expect(harness.store.routes().contains(.erase))
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.store.owner?.ownerIdentifier == harness.ownerIdentifier)
    }

    @Test func aCachedLaunchWhoseOwnerUpdateFailsAfterASocketOpenedConfirmsOnALaterWriteAndSends() async throws {
        let harness = try harnessWithAWaitingChange()
        harness.vault.secret = harness.session
        harness.service.failures[.updateOwner] = .unexpected(status: 503)
        harness.service.suspend(.updateOwner)
        harness.service.suspend(.readChanges)
        let launching = Task { await harness.model.launch() }
        await harness.service.held(.updateOwner)
        harness.signals.send(.opened, to: harness.watchKey(inboxIdentifier))
        await harness.service.held(.readChanges)
        harness.service.unsuspend(.readChanges)
        harness.service.resume(.readChanges)
        harness.service.unsuspend(.updateOwner)
        harness.service.resume(.updateOwner)
        await launching.value
        await harness.model.complete(task: secondTask)
        await harness.model.workspaceReload?.value
        #expect(harness.model.syncStatus == .offline(waiting: 2))
        harness.service.failures = [:]
        await harness.model.refresh()
        await harness.model.workspaceReload?.value
        await harness.flushed()
        #expect(harness.service.calls.contains(.completeTasks(session: harness.session, projectIdentifier: inboxIdentifier, numbers: [2])))
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.model.syncStatus == .online)
    }

    @Test func aLaunchWhoseOwnerUpdateFailsOnceConfirmsAfterTheReconnectDelayAndSends() async throws {
        let harness = try harnessWithAWaitingChange()
        harness.service.failures[.updateOwner] = .unexpected(status: 503)
        await harness.launchedFromCache()
        #expect(harness.model.syncStatus == .offline(waiting: 1))
        harness.service.failures = [:]
        let retry = try #require(harness.model.ownerConfirmationRetry)
        await harness.pause.started()
        harness.pause.release()
        await retry.value
        await harness.model.workspaceReload?.value
        await harness.flushed()
        #expect(harness.pause.durations == [.seconds(1)])
        #expect(harness.service.calls.contains(.updateTask(session: harness.session, projectIdentifier: inboxIdentifier, number: 1, patch: .title("Waiting"))))
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.model.syncStatus == .online)
    }

    @Test func anOwnerUpdateThatKeepsFailingIsTriedAgainAfterGrowingDelays() async throws {
        let harness = try harnessWithAWaitingChange()
        harness.service.failures[.updateOwner] = .unexpected(status: 503)
        await harness.launchedFromCache()
        let firstRetry = try #require(harness.model.ownerConfirmationRetry)
        await harness.pause.started()
        harness.pause.release()
        await firstRetry.value
        await harness.model.workspaceReload?.value
        await harness.pause.started(count: 2)
        #expect(harness.pause.durations == [.seconds(1), .seconds(2)])
        #expect(harness.service.routes().filter { $0 == .updateOwner }.count == 1)
        #expect(harness.service.routes().contains(.updateTask) == false)
    }

    @Test func aSignOutCancelsTheOwnerUpdateWaitingToBeTriedAgain() async throws {
        let harness = try harnessWithAWaitingChange()
        harness.service.failures[.updateOwner] = .unexpected(status: 503)
        await harness.launchedFromCache()
        let retry = try #require(harness.model.ownerConfirmationRetry)
        await harness.model.signOut()
        await retry.value
        #expect(harness.service.calls == [.signOut(session: harness.session)])
    }

    @Test func aLaunchWhoseZoneIsRefusedConfirmsTheOwnerByReadingItAndSends() async throws {
        let harness = try harnessWithAWaitingChange()
        harness.service.failures[.updateOwner] = .timeZoneInvalid
        harness.vault.secret = harness.session
        await harness.model.launch()
        await harness.flushed()
        #expect(
            Array(harness.service.calls.prefix(2)) == [
                .updateOwner(session: harness.session, timeZone: harnessTimeZoneIdentifier),
                .readOwner(session: harness.session),
            ]
        )
        #expect(harness.service.calls.contains(.updateTask(session: harness.session, projectIdentifier: inboxIdentifier, number: 1, patch: .title("Waiting"))))
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func aLaunchWhoseZoneIsRefusedAndWhoseOwnerReadNamesAnotherOwnerErasesTheCacheAndSendsNothing() async throws {
        let harness = try harnessWithAWaitingChange()
        let acme = try #require(harness.service.workspaces.first)
        harness.cache([acme], active: acme, ownerIdentifier: cachedOwnerIdentifier)
        harness.service.failures[.updateOwner] = .timeZoneInvalid
        harness.vault.secret = harness.session
        await harness.model.launch()
        await harness.flushed()
        #expect(Array(harness.service.routes().prefix(2)) == [.updateOwner, .readOwner])
        #expect(harness.service.routes().contains(.updateTask) == false)
        #expect(harness.store.routes().contains(.erase))
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.model.taskViews?.inbox.map(\.task.title) == ["Task 1", "Task 2"])
        #expect(harness.store.owner?.ownerIdentifier == harness.ownerIdentifier)
    }

    @Test func aLaunchAsAnotherOwnerWhoseListingFailsSaysSoWithTryAgain() async throws {
        let harness = try harnessWithAWaitingChange()
        let acme = try #require(harness.service.workspaces.first)
        harness.cache([acme], active: acme, ownerIdentifier: cachedOwnerIdentifier)
        harness.service.failures[.listWorkspaces] = .unreachable
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(harness.store.routes().contains(.erase))
        #expect(harness.model.phase == .loading)
        #expect(harness.model.banner == .network)
        #expect(harness.model.canTryAgain)
    }

    @Test func aLaunchWhoseOwnerUpdateFailsWritesNothingUnderTheCachedOwnerUntilTheOwnerIsConfirmed() async throws {
        let harness = try harnessWithAWaitingChange()
        let acme = try #require(harness.service.workspaces.first)
        harness.cache([acme], active: acme, ownerIdentifier: cachedOwnerIdentifier)
        harness.service.failures[.updateOwner] = .unexpected(status: 503)
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(harness.service.routes().contains(.listWorkspaces) == false)
        #expect(harness.store.routes().contains(.writeOwner) == false)
        #expect(harness.store.routes().contains(.writeProject) == false)
        #expect(harness.store.owner?.ownerIdentifier == cachedOwnerIdentifier)
        harness.service.failures = [:]
        harness.store.calls = []
        let retry = try #require(harness.model.ownerConfirmationRetry)
        await harness.pause.started()
        harness.pause.release()
        await retry.value
        await harness.model.workspaceReload?.value
        let routes = harness.store.routes()
        let firstErase = try #require(routes.firstIndex(of: .erase))
        let firstWrite = try #require(routes.firstIndex { $0 == .writeOwner || $0 == .writeProject })
        #expect(firstErase < firstWrite)
        #expect(harness.store.owner?.ownerIdentifier == harness.ownerIdentifier)
    }

    @Test func aLaunchWhoseOwnerUpdateFailsKeepsTheCachedOwnersWindowAndChangesUntilTheOwnerIsConfirmed() async throws {
        let harness = try AppModelHarness()
        let bravo = harness.seedWorkspace(name: "bravo")
        let acme = harness.seedWorkspace(name: "acme")
        let bravoTask = TaskKey(projectIdentifier: "bravo-inbox", number: 1)
        harness.seedTasks(projectIdentifier: bravoTask.projectIdentifier, count: 1)
        harness.cache([bravo], active: bravo)
        harness.cacheTasks(projectIdentifier: bravoTask.projectIdentifier, count: 1, cursor: 1)
        try harness.store.keep(Outbox().appending(.field(bravoTask, .title("Waiting")), isHeadSent: false))
        harness.service.workspaces = [acme]
        harness.service.failures[.updateOwner] = .unexpected(status: 503)
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(harness.model.workspaces.map(\.identifier) == [bravo.identifier])
        #expect(harness.model.waitingChangeCount == 1)
        #expect(harness.service.routes().contains(.updateTask) == false)
        let storeWrites: [StoreRoute] = [.writeOwner, .writeProject, .writeOutbox, .eraseProject, .erase]
        #expect(harness.store.routes().contains { storeWrites.contains($0) } == false)
        harness.service.workspaces = [bravo]
        harness.service.failures = [:]
        let retry = try #require(harness.model.ownerConfirmationRetry)
        await harness.pause.started()
        harness.pause.release()
        await retry.value
        await harness.model.workspaceReload?.value
        await harness.flushed()
        #expect(
            harness.service.calls.contains(
                .updateTask(session: harness.session, projectIdentifier: bravoTask.projectIdentifier, number: bravoTask.number, patch: .title("Waiting"))
            )
        )
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func aLaunchWithNoCachedWorkspaceWhoseOwnerUpdateFailsSaysSoWithTryAgainThenLists() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        harness.store.owner = OwnerCache(ownerIdentifier: harness.ownerIdentifier, workspaces: [], activeWorkspaceIdentifier: nil)
        harness.service.failures[.updateOwner] = .unreachable
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(harness.model.phase == .loading)
        #expect(harness.model.banner == .network)
        #expect(harness.model.canTryAgain)
        #expect(harness.service.routes().contains(.listWorkspaces) == false)
        harness.service.failures = [:]
        await harness.model.tryAgain()
        #expect(harness.model.phase == .ready)
        #expect(harness.model.workspaces == [acme])
    }

    @Test func aLaunchAsAnotherOwnerWhoseEraseFailsStaysUnconfirmedEmptiesTheWindowAndSaysSoWithTryAgain() async throws {
        let harness = try harnessWithAWaitingChange()
        let acme = try #require(harness.service.workspaces.first)
        harness.cache([acme], active: acme, ownerIdentifier: cachedOwnerIdentifier)
        harness.store.failures[.erase] = .unwritable
        harness.vault.secret = harness.session
        await harness.model.launch()
        await harness.flushed()
        #expect(harness.service.routes().contains(.updateTask) == false)
        #expect(harness.store.routes().contains(.writeOwner) == false)
        #expect(harness.store.routes().contains(.writeOutbox) == false)
        #expect(harness.store.routes().contains(.writeProject) == false)
        #expect(harness.model.isOwnerConfirmed == false)
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.model.workspaces.isEmpty)
        #expect(harness.model.board == TaskBoard())
        #expect(harness.model.phase == .loading)
        #expect(harness.model.banner == .cacheNotSaved)
        #expect(harness.model.canTryAgain)
        harness.store.failures = [:]
        await harness.model.tryAgain()
        #expect(harness.model.phase == .ready)
        #expect(harness.store.owner?.ownerIdentifier == harness.ownerIdentifier)
    }

    @Test func aSessionEndedKeepsTheCacheAndTheWaitingChanges() async throws {
        let harness = try harnessWithAWaitingChange()
        harness.service.failures[.updateTask] = .unreachable
        await harness.launchedFromCache()
        harness.service.failures[.readChanges] = .unauthorized
        await harness.model.refresh()
        #expect(harness.model.phase == .signedOut(notice: .sessionEnded))
        #expect(harness.store.routes().contains(.erase) == false)
        #expect(harness.store.owner != nil)
        #expect(harness.model.waitingChangeCount == 1)
        await harness.signals.cancelled(harness.watchKey(inboxIdentifier))
    }
}
