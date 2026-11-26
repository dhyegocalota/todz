import Foundation
import Testing
@testable import TodzKit

@MainActor @Suite struct AppModelTests {
    @Test func launchWithNoSecretIsSignedOutWithoutANotice() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        #expect(harness.model.phase == .signedOut(notice: nil))
        #expect(harness.service.calls == [])
    }

    @Test func launchWithAnUnreadableVaultSaysSo() async throws {
        let harness = try AppModelHarness()
        harness.vault.isUnreadable = true
        await harness.model.launch()
        #expect(harness.model.phase == .signedOut(notice: .sessionUnreadable))
        #expect(harness.service.calls == [])
    }

    @Test func launchWithASecretSendsTheZoneThenListsTheWorkspaces() async throws {
        let harness = try AppModelHarness()
        let workspace = harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        harness.seedTasks(projectIdentifier: "acme-inbox", count: 2)
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(
            Array(harness.service.calls.prefix(2)) == [
                .updateOwner(session: harness.session, timeZone: harnessTimeZoneIdentifier),
                .listWorkspaces(session: harness.session),
            ]
        )
        let pulls = workspace.projects.map { FakeCall.readChanges(session: harness.session, projectIdentifier: $0.identifier, cursor: 0) }
        #expect(isSameCallSet(Array(harness.service.calls.dropFirst(2)), pulls))
        #expect(harness.model.phase == .ready)
        #expect(harness.model.activeWorkspace == workspace)
        #expect(harness.model.selectedItem == .inbox)
        #expect(harness.model.taskViews?.inbox.map(\.task.number) == [1, 2])
        #expect(harness.model.projectLoads == ["acme-inbox": .loaded, "acme-launch": .loaded])
    }

    @Test func aSecondLaunchWhileTheFirstWaitsOnTheServiceReturnsAtOnceWithoutReadingTheVault() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.vault.secret = harness.session
        harness.service.suspend(.updateOwner)
        let firstLaunch = Task { await harness.model.launch() }
        await harness.service.held(.updateOwner)
        harness.vault.isUnreadable = true
        await harness.model.launch()
        #expect(harness.model.phase == .loading)
        harness.service.unsuspend(.updateOwner)
        harness.service.resume(.updateOwner)
        await firstLaunch.value
        #expect(harness.service.routes().filter { $0 == .updateOwner }.count == 1)
        #expect(harness.model.phase == .ready)
    }

    @Test func aLaunchAfterAFinishedLaunchCallsNothing() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        await harness.model.launch()
        #expect(harness.service.calls == [])
        #expect(harness.model.phase == .ready)
    }

    @Test func aRefusedZoneAtLaunchShowsNothingAndGoesOn() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: "acme-inbox", count: 1)
        let firstTask = TaskKey(projectIdentifier: "acme-inbox", number: 1)
        try harness.store.keep(Outbox().appending(.field(firstTask, .title("Waiting")), isHeadSent: false))
        harness.service.failures[.updateOwner] = .timeZoneInvalid
        await harness.signedIn()
        await harness.flushed()
        #expect(harness.model.phase == .ready)
        #expect(harness.model.banner == nil)
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.service.tasksOfProject["acme-inbox"]?.first?.title == "Waiting")
    }

    @Test func launchWithASecretAndNoWorkspaceAsksForItsName() async throws {
        let harness = try AppModelHarness()
        await harness.signedIn()
        #expect(harness.model.phase == .naming)
    }

    @Test func signInStoresTheSecretAndAsksForANameWithNoWorkspace() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        await harness.model.signIn(identity: "dhyego")
        #expect(harness.vault.secret == harness.service.issuedSession.sessionToken)
        #expect(harness.model.phase == .naming)
        #expect(
            harness.service.calls == [
                .signIn(identityToken: "dhyego", linkVerifier: nil, turnstileToken: nil, timeZone: harnessTimeZoneIdentifier),
                .listWorkspaces(session: harness.service.issuedSession.sessionToken),
            ]
        )
        #expect(harness.model.lastIdentity == "dhyego")
        #expect(harness.model.isSigningIn == false)
    }

    @Test func signInWithWorkspacesOffersThemThenOpensTheChosenOneWithItsInbox() async throws {
        let harness = try AppModelHarness()
        let oldest = harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "side")
        harness.seedTasks(projectIdentifier: "acme-inbox", count: 1)
        await harness.model.launch()
        await harness.model.signIn(identity: "dhyego")
        #expect(harness.model.phase == .choosing)
        await harness.model.chooseWorkspace(identifier: oldest.identifier)
        #expect(harness.model.phase == .ready)
        #expect(harness.model.activeWorkspace == oldest)
        #expect(harness.model.selectedItem == .inbox)
        #expect(harness.model.taskViews?.inbox.count == 1)
    }

    @Test func aVaultThatCannotWriteStillSignsInAndSaysSo() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.vault.isUnwritable = true
        await harness.model.launch()
        await harness.model.signIn(identity: "dhyego")
        #expect(harness.model.phase == .ready)
        #expect(harness.model.banner == .sessionNotSaved)
    }

    @Test(arguments: [
        (OwnerAPIError.timeZoneInvalid, SignInError.timeZoneInvalid),
        (.identityRejected, .identityRejected),
        (.signInUnavailable, .signInUnavailable),
        (.unreachable, .unreachable),
        (.invalidRequest, .unexpected),
    ])
    func aRefusedSignInStaysSignedOutWithItsError(failure: OwnerAPIError, expected: SignInError) async throws {
        let harness = try AppModelHarness()
        harness.service.failures[.signIn] = failure
        await harness.model.launch()
        await harness.model.signIn(identity: "dhyego")
        #expect(harness.model.phase == .signedOut(notice: nil))
        #expect(harness.model.signInError == expected)
        #expect(harness.vault.secret == nil)
        #expect(harness.service.routes() == [.signIn])
    }

    @Test func signOutEndsTheSessionErasesTheVaultAndForgetsTheBoard() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: "acme-inbox", count: 2)
        await harness.signedIn()
        await harness.model.signOut()
        #expect(harness.service.calls == [.signOut(session: harness.session)])
        #expect(harness.vault.eraseCount == 1)
        #expect(harness.vault.secret == nil)
        #expect(harness.model.phase == .signedOut(notice: nil))
        #expect(harness.model.board == TaskBoard())
        #expect(harness.model.workspaces == [])
    }
}
