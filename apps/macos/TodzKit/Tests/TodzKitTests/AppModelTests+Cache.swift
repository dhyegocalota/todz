import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let launchIdentifier = "acme-launch"
private let firstTask = TaskKey(projectIdentifier: inboxIdentifier, number: 1)
private let undecodableOutbox = Data("not an outbox".utf8)

enum UnreadableOutbox: CaseIterable, Sendable {
    case unreadable
    case undecodable
}

extension AppModelTests {
    @MainActor private func cachedHarness() throws -> AppModelHarness {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 3)
        harness.seedTasks(projectIdentifier: launchIdentifier, count: 1)
        harness.cache([acme], active: acme)
        harness.cacheTasks(projectIdentifier: inboxIdentifier, count: 2, cursor: 2)
        harness.cacheTasks(projectIdentifier: launchIdentifier, count: 1, cursor: 1)
        return harness
    }

    @MainActor private func isOwnerFileCurrent(_ harness: AppModelHarness) -> Bool {
        let current = OwnerCache(
            ownerIdentifier: harness.ownerIdentifier,
            workspaces: harness.model.workspaces,
            activeWorkspaceIdentifier: harness.model.activeWorkspaceIdentifier
        )
        return harness.store.owner == current
    }

    @Test func aCachedLaunchShowsTheCachedWindowBeforeAnyAnswer() async throws {
        let harness = try cachedHarness()
        try harness.store.keep(Outbox().appending(.field(firstTask, .title("Waiting")), isHeadSent: false))
        harness.service.suspend(.updateOwner)
        harness.vault.secret = harness.session
        let launching = Task { await harness.model.launch() }
        await harness.service.held(.updateOwner)
        #expect(harness.model.phase == .ready)
        #expect(harness.model.activeWorkspace?.identifier == "acme")
        #expect(harness.model.taskViews?.inbox.map(\.task.title) == ["Waiting", "Cached 2"])
        #expect(harness.model.taskViews?.project(identifier: launchIdentifier).map(\.task.title) == ["Cached 1"])
        #expect(harness.model.projectLoads == [inboxIdentifier: .loaded, launchIdentifier: .loaded])
        #expect(harness.signals.opens == [harness.watchKey(inboxIdentifier), harness.watchKey(launchIdentifier)])
        #expect(harness.service.routes() == [.updateOwner])
        harness.service.resume(.updateOwner)
        await launching.value
    }

    @Test func aCachedLaunchPullsEachProjectFromItsStoredCursorAndStoresTheNewOne() async throws {
        let harness = try cachedHarness()
        let routesAtOwnerWrite = Captured<[FakeRoute]>()
        harness.store.onCall = { call in
            guard case .writeOwner = call, routesAtOwnerWrite.value == nil else { return }
            routesAtOwnerWrite.value = harness.service.routes()
        }
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(
            Array(harness.service.calls.prefix(2)) == [
                .updateOwner(session: harness.session, timeZone: harnessTimeZoneIdentifier),
                .listWorkspaces(session: harness.session),
            ]
        )
        let pulls: [FakeCall] = [
            .readChanges(session: harness.session, projectIdentifier: inboxIdentifier, cursor: 2),
            .readChanges(session: harness.session, projectIdentifier: launchIdentifier, cursor: 1),
        ]
        #expect(isSameCallSet(Array(harness.service.calls.dropFirst(2)), pulls))
        #expect(routesAtOwnerWrite.value == [.updateOwner, .listWorkspaces])
        #expect(harness.store.projects[inboxIdentifier]?.cursor == 3)
        #expect(harness.store.projects[inboxIdentifier]?.tasks.map(\.title) == ["Cached 1", "Cached 2", "Task 3"])
        #expect(harness.store.projects[launchIdentifier]?.cursor == 1)
        #expect(harness.model.taskViews?.inbox.map(\.task.title) == ["Cached 1", "Cached 2", "Task 3"])
    }

    @Test func aCachedLaunchWithTheServerDownWaitsForASocketToOpen() async throws {
        let harness = try cachedHarness()
        harness.service.failures[.updateOwner] = .unreachable
        harness.service.failures[.listWorkspaces] = .unreachable
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(harness.model.phase == .ready)
        #expect(harness.model.banner == nil)
        #expect(harness.model.taskViews?.inbox.count == 2)
        #expect(harness.service.routes() == [.updateOwner, .listWorkspaces])
        harness.service.failures = [:]
        harness.service.calls = []
        harness.service.suspend(.readChanges)
        harness.signals.send(.opened, to: harness.watchKey(launchIdentifier))
        await harness.service.held(.readChanges, count: 2)
        #expect(harness.service.calls.first == .listWorkspaces(session: harness.session))
        #expect(harness.service.calls.contains(.readChanges(session: harness.session, projectIdentifier: launchIdentifier, cursor: 1)))
        harness.service.unsuspend(.readChanges)
        harness.service.resume(.readChanges)
        harness.service.resume(.readChanges)
    }

    @Test func anOwnerOtherThanTheCachesEmptiesEverythingAndErasesTheCacheBeforeLoading() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 1)
        harness.cache([acme], active: acme, ownerIdentifier: "someone-else")
        harness.cacheTasks(projectIdentifier: inboxIdentifier, count: 2, cursor: 2)
        try harness.store.keep(Outbox().appending(.field(firstTask, .title("Theirs")), isHeadSent: false))
        let isEmptiedAtErase = Captured<Bool>()
        harness.store.onCall = { call in
            guard call == .erase else { return }
            let model = harness.model
            let isMemoryEmpty = model.board == TaskBoard() && model.workspaces.isEmpty && model.outbox == Outbox()
            isEmptiedAtErase.value = isMemoryEmpty && model.watches.isEmpty
        }
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(isEmptiedAtErase.value == true)
        #expect(
            harness.service.calls == [
                .updateOwner(session: harness.session, timeZone: harnessTimeZoneIdentifier),
                .listWorkspaces(session: harness.session),
                .readChanges(session: harness.session, projectIdentifier: inboxIdentifier, cursor: 0),
            ]
        )
        #expect(harness.model.phase == .ready)
        #expect(harness.model.taskViews?.inbox.map(\.task.title) == ["Task 1"])
        #expect(harness.model.waitingChangeCount == 0)
        await harness.signals.cancelled(harness.watchKey(inboxIdentifier))
        #expect(harness.signals.openCount(of: harness.watchKey(inboxIdentifier)) == 2)
    }

    @Test func aLaunchWithASessionAndNoCacheGoesTheShellsWayAndCachesWhatItLoads() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 2)
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(Array(harness.store.routes().prefix(2)) == [.readOwner, .readOutbox])
        #expect(harness.store.owner == OwnerCache(ownerIdentifier: harness.ownerIdentifier, workspaces: [acme], activeWorkspaceIdentifier: acme.identifier))
        #expect(harness.store.projects[inboxIdentifier]?.cursor == 2)
        #expect(harness.signals.opens == [harness.watchKey(inboxIdentifier)])
    }

    @Test func aLaunchWithNoSessionReadsOnlyTheOutbox() async throws {
        let harness = try cachedHarness()
        let waiting = Outbox()
            .appending(.field(firstTask, .title("One")), isHeadSent: false)
            .appending(.state(firstTask, .done, at: fixedInstant), isHeadSent: false)
        try harness.store.keep(waiting)
        await harness.model.launch()
        #expect(harness.store.calls == [.readOutbox])
        #expect(harness.model.waitingChangeCount == 2)
        #expect(harness.model.phase == .signedOut(notice: nil))
        #expect(harness.service.calls == [])
        #expect(harness.signals.opens == [])
    }

    @Test func switchingToACachedWorkspaceShowsItsRowsBeforeItsPull() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side", projectNames: ["garden"])
        harness.cache([acme, side], active: acme)
        harness.cacheTasks(projectIdentifier: inboxIdentifier, count: 1, cursor: 1)
        harness.cacheTasks(projectIdentifier: "side-inbox", count: 2, cursor: 2)
        await harness.launchedFromCache()
        harness.service.suspend(.readChanges)
        let switching = Task { await harness.model.switchWorkspace(identifier: side.identifier) }
        await harness.service.held(.readChanges, count: 2)
        #expect(harness.model.taskViews?.inbox.map(\.task.title) == ["Cached 1", "Cached 2"])
        #expect(harness.model.projectLoads == ["side-inbox": .loaded])
        #expect(harness.store.calls.contains(.readProject(identifier: "side-garden")))
        harness.service.unsuspend(.readChanges)
        harness.service.resume(.readChanges)
        harness.service.resume(.readChanges)
        await switching.value
    }

    @Test func theOwnerFileFollowsEverySwitchCreateAndRename() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        let side = harness.seedWorkspace(name: "side")
        await harness.signedIn()
        #expect(isOwnerFileCurrent(harness))
        harness.store.calls = []
        await harness.model.switchWorkspace(identifier: side.identifier)
        #expect(isOwnerFileCurrent(harness))
        await harness.model.switchWorkspace(identifier: acme.identifier)
        await harness.model.renameProject(projectIdentifier: launchIdentifier, name: "Ship")
        #expect(harness.store.owner?.workspaces.first?.projects.map(\.name) == ["Inbox", "Ship"])
        await harness.model.createProject(name: "Garden")
        #expect(harness.store.owner?.workspaces.first?.projects.map(\.name) == ["Inbox", "Ship", "Garden"])
        await harness.model.createWorkspace(name: "Home")
        #expect(isOwnerFileCurrent(harness))
        #expect(harness.store.owner?.workspaces.count == 3)
        #expect(harness.store.routes().filter { $0 == .writeOwner }.count >= 5)
    }

    @Test func aSignInWritesTheOwnerFileWithTheIssuedOwner() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        await harness.model.launch()
        await harness.model.signIn(identity: "dhyego")
        #expect(harness.store.owner?.ownerIdentifier == harness.service.issuedSession.owner.identifier)
        #expect(isOwnerFileCurrent(harness))
    }

    @Test func withNoOwnerKnownTheOwnerFileIsNeverWritten() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.service.failures[.updateOwner] = .timeZoneInvalid
        await harness.signedIn()
        #expect(harness.model.phase == .ready)
        #expect(harness.store.routes().contains(.writeOwner) == false)
    }

    @Test(arguments: [StoreRoute.writeProject, .writeOwner, .writeOutbox])
    func aCacheThatCannotBeWrittenSaysSoOncePerLaunchAndGoesOn(route: StoreRoute) async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 2)
        harness.store.failures[route] = .unwritable
        await harness.signedIn()
        await harness.model.complete(task: firstTask)
        await harness.flushed()
        #expect(harness.model.banner == .cacheNotSaved)
        #expect(harness.model.board.task(projectIdentifier: inboxIdentifier, number: 1)?.state == .done)
        harness.model.dismissBanner()
        await harness.model.updateTitle(task: firstTask, title: "Renamed")
        await harness.flushed()
        await harness.model.switchWorkspace(identifier: "acme")
        #expect(harness.model.banner == nil)
        #expect(harness.model.board.task(projectIdentifier: inboxIdentifier, number: 1)?.title == "Renamed")
    }

    @Test func anUnreadableProjectFileIsErasedAndPulledFromZero() async throws {
        let harness = try cachedHarness()
        harness.store.failures[.readProject] = .unreadable
        harness.service.suspend(.updateOwner)
        harness.vault.secret = harness.session
        let launching = Task { await harness.model.launch() }
        await harness.service.held(.updateOwner)
        #expect(harness.model.phase == .ready)
        #expect(harness.model.projectLoads == [:])
        #expect(harness.store.calls.contains(.eraseProject(identifier: inboxIdentifier)))
        #expect(harness.store.calls.contains(.eraseProject(identifier: launchIdentifier)))
        harness.service.resume(.updateOwner)
        await launching.value
        #expect(harness.service.calls.contains(.readChanges(session: harness.session, projectIdentifier: inboxIdentifier, cursor: 0)))
        #expect(harness.model.taskViews?.inbox.map(\.task.title) == ["Task 1", "Task 2", "Task 3"])
    }

    @Test func anUnreadableOwnerFileAtLaunchErasesTheCacheAndLoadsAsTheShellDoes() async throws {
        let harness = try cachedHarness()
        harness.store.failures[.readOwner] = .unreadable
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(Array(harness.store.routes().prefix(3)) == [.readOwner, .erase, .readOutbox])
        #expect(harness.service.calls.contains(.readChanges(session: harness.session, projectIdentifier: inboxIdentifier, cursor: 0)))
        #expect(harness.model.phase == .ready)
        #expect(harness.model.taskViews?.inbox.map(\.task.title) == ["Task 1", "Task 2", "Task 3"])
    }

    @Test(arguments: UnreadableOutbox.allCases)
    func anUnreadableOutboxIsReplacedByAnEmptyOneAndToldOnce(unreadable: UnreadableOutbox) async throws {
        let harness = try cachedHarness()
        switch unreadable {
        case .unreadable: harness.store.failures[.readOutbox] = .unreadable
        case .undecodable: harness.store.outbox = undecodableOutbox
        }
        harness.vault.secret = harness.session
        await harness.model.launch()
        let emptyOutbox = try OwnerCoding.encoder().encode(Outbox())
        #expect(harness.store.calls.contains(.writeOutbox(emptyOutbox)))
        #expect(harness.model.banner == .waitingChangesLost)
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.model.phase == .ready)
        #expect(harness.model.taskViews?.inbox.count == 3)
    }
}
