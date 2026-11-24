import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let launchIdentifier = "acme-launch"
private let sideInboxIdentifier = "side-inbox"
private let launchKey = OwnerFixtures.projectKey(identifier: "launch-key")
private let inboxTask = TaskKey(projectIdentifier: inboxIdentifier, number: 1)

@MainActor private func keyHarness() async throws -> AppModelHarness {
    let harness = try AppModelHarness()
    harness.seedWorkspace(name: "acme", projectNames: ["launch"])
    harness.seedWorkspace(name: "side")
    harness.seedTasks(projectIdentifier: inboxIdentifier, count: 1)
    harness.service.keysOfProject[launchIdentifier] = [launchKey]
    await harness.signedIn()
    return harness
}

@MainActor private func openKeys(_ harness: AppModelHarness, from item: SidebarItem) async {
    harness.model.selectedItem = item
    harness.model.selectedItem = .connectAgent
    await harness.model.keyLoading?.value
    harness.service.calls = []
}

@MainActor private func issuedKeyOfLaunch(_ harness: AppModelHarness) async throws -> IssuedKey {
    await openKeys(harness, from: .project(identifier: launchIdentifier))
    await harness.model.issueKey()
    return try #require(harness.model.issuedKey)
}

@MainActor private func expectNoKeyScreen(_ model: AppModel) {
    #expect(model.keyProjectIdentifier == nil)
    #expect(model.keys == nil)
    #expect(model.issuedKey == nil)
    #expect(model.issueFailure == nil)
    #expect(model.keyReloadFailure == nil)
}

extension AppModelTests {
    @Test func enteringFromAProjectShowsItsKeysAndClearsTheSelectedTask() async throws {
        let harness = try await keyHarness()
        harness.model.selectedItem = .project(identifier: launchIdentifier)
        harness.model.selectedTask = TaskKey(projectIdentifier: launchIdentifier, number: 1)
        harness.model.selectedItem = .connectAgent
        await harness.model.keyLoading?.value
        #expect(harness.model.keyProjectIdentifier == launchIdentifier)
        #expect(harness.model.keys == .loaded([launchKey]))
        #expect(harness.model.selectedTask == nil)
        #expect(harness.service.calls == [.listKeys(session: harness.session, projectIdentifier: launchIdentifier)])
    }

    @Test(arguments: [SidebarItem.inbox, .today, .upcoming, .done])
    func enteringFromAViewShowsTheInboxKeys(item: SidebarItem) async throws {
        let harness = try await keyHarness()
        harness.model.selectedItem = item
        harness.model.selectedItem = .connectAgent
        await harness.model.keyLoading?.value
        #expect(harness.model.keyProjectIdentifier == inboxIdentifier)
        #expect(harness.model.keys == .loaded([]))
        #expect(harness.service.calls == [.listKeys(session: harness.session, projectIdentifier: inboxIdentifier)])
    }

    @Test func theKeysShowAsLoadingUntilTheListAnswers() async throws {
        let harness = try await keyHarness()
        harness.service.suspend(.listKeys)
        harness.model.selectedItem = .project(identifier: launchIdentifier)
        harness.model.selectedItem = .connectAgent
        await harness.service.held(.listKeys)
        #expect(harness.model.keys == .loading)
        harness.service.resume(.listKeys)
        await harness.model.keyLoading?.value
        #expect(harness.model.keys == .loaded([launchKey]))
    }

    @Test func choosingAnotherProjectShowsItsKeysAndForgetsTheSecret() async throws {
        let harness = try await keyHarness()
        _ = try await issuedKeyOfLaunch(harness)
        harness.model.showKeys(projectIdentifier: inboxIdentifier)
        await harness.model.keyLoading?.value
        #expect(harness.model.keyProjectIdentifier == inboxIdentifier)
        #expect(harness.model.issuedKey == nil)
        #expect(harness.model.keys == .loaded([]))
    }

    @Test func aProjectOutsideTheActiveWorkspaceIsNotShown() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .inbox)
        harness.model.showKeys(projectIdentifier: sideInboxIdentifier)
        #expect(harness.model.keyProjectIdentifier == inboxIdentifier)
        #expect(harness.service.calls == [])
    }

    @Test func issuingAppendsTheKeyAndHoldsItsSecret() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.suspend(.issueKey)
        let issuing = Task { await harness.model.issueKey() }
        await harness.service.held(.issueKey)
        #expect(harness.model.isIssuing)
        harness.service.resume(.issueKey)
        await issuing.value
        let created = try #require(harness.service.keysOfProject[launchIdentifier]?.last)
        #expect(harness.model.isIssuing == false)
        #expect(harness.model.issuedKey?.key == created)
        #expect(harness.model.issuedKey?.secret == "todz_fake-secret-1")
        #expect(harness.model.keys == .loaded([launchKey, created]))
        #expect(harness.service.calls == [.issueKey(session: harness.session, projectIdentifier: launchIdentifier)])
    }

    @Test func hidingTheKeyForgetsTheSecretAndKeepsTheList() async throws {
        let harness = try await keyHarness()
        let issued = try await issuedKeyOfLaunch(harness)
        harness.model.hideKey()
        #expect(harness.model.issuedKey == nil)
        #expect(harness.model.keys == .loaded([launchKey, issued.key]))
    }

    @Test func leavingTheScreenForgetsTheSecretAndKeepsTheList() async throws {
        let harness = try await keyHarness()
        let issued = try await issuedKeyOfLaunch(harness)
        harness.model.leaveKeyScreen()
        #expect(harness.model.issuedKey == nil)
        #expect(harness.model.keys == .loaded([launchKey, issued.key]))
    }

    @Test func anIssueAnswerAfterLeavingTheScreenInTheSameWindowShowsNoSecret() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.suspend(.issueKey)
        let issuing = Task { await harness.model.issueKey() }
        await harness.service.held(.issueKey)
        harness.model.leaveKeyScreen()
        harness.service.resume(.issueKey)
        await issuing.value
        #expect(harness.model.issuedKey == nil)
        #expect(harness.model.isIssuing == false)
        harness.model.reopenKeyScreen()
        await harness.model.keyLoading?.value
        let committed = try #require(harness.service.keysOfProject[launchIdentifier]?.last)
        #expect(harness.model.issuedKey == nil)
        #expect(harness.model.keyProjectIdentifier == launchIdentifier)
        #expect(harness.model.keys == .loaded([launchKey, committed]))
    }

    @Test func reopeningTheScreenWithNoProjectShowsTheInboxKeys() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.model.forgetKeys()
        harness.model.reopenKeyScreen()
        await harness.model.keyLoading?.value
        #expect(harness.model.keyProjectIdentifier == inboxIdentifier)
        #expect(harness.model.keys == .loaded([]))
    }

    @Test func reopeningTheScreenOfAProjectGoneElsewhereShowsTheInboxKeys() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.model.leaveKeyScreen()
        harness.model.workspaces = harness.model.workspaces.map { workspace in
            Workspace(
                identifier: workspace.identifier,
                name: workspace.name,
                createdAt: workspace.createdAt,
                projects: workspace.projects.filter { $0.identifier != launchIdentifier }
            )
        }
        harness.model.reopenKeyScreen()
        await harness.model.keyLoading?.value
        #expect(harness.model.keyScreenIdentifier != nil)
        #expect(harness.model.keyProjectIdentifier == inboxIdentifier)
    }

    @Test func reopeningTheScreenAlreadyLoadingStartsNoSecondLoad() async throws {
        let harness = try await keyHarness()
        harness.model.selectedItem = .project(identifier: launchIdentifier)
        harness.model.selectedItem = .connectAgent
        harness.model.reopenKeyScreen()
        await harness.model.keyLoading?.value
        #expect(harness.service.routes() == [.listKeys])
    }

    @Test func aReloadThatMissedTheIssuedKeyKeepsItListed() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.suspend(.listKeys)
        let reloading = Task { await harness.model.loadKeys() }
        await harness.service.held(.listKeys)
        await harness.model.issueKey()
        let issued = try #require(harness.model.issuedKey)
        harness.service.keysOfProject[launchIdentifier] = [launchKey]
        harness.service.resume(.listKeys)
        await reloading.value
        #expect(harness.model.issuedKey == issued)
        #expect(harness.model.keys == .loaded([launchKey, issued.key]))
    }

    @Test func aReloadStartedAfterTheIssueDropsAKeyRevokedElsewhere() async throws {
        let harness = try await keyHarness()
        let issued = try await issuedKeyOfLaunch(harness)
        harness.service.keysOfProject[launchIdentifier] = [launchKey]
        await harness.model.loadKeys()
        #expect(harness.model.issuedKey == issued)
        #expect(harness.model.keys == .loaded([launchKey]))
    }

    @Test func aReloadThatListedTheIssuedKeyFirstListsItOnce() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.suspend(.issueKey)
        let issuing = Task { await harness.model.issueKey() }
        await harness.service.held(.issueKey)
        let committed = OwnerFixtures.projectKey(identifier: harness.service.nextKeyIdentifier())
        harness.service.keysOfProject[launchIdentifier] = [launchKey, committed]
        await harness.model.loadKeys()
        harness.service.resume(.issueKey)
        await issuing.value
        #expect(harness.model.issuedKey?.key.identifier == committed.identifier)
        #expect(harness.model.keys == .loaded([launchKey, committed]))
    }

    @Test func aFailedIssueShowsNoSecretAndListsAKeyTheServerCommitted() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.failures[.issueKey] = .unexpected(status: 500)
        harness.service.onCall = { call in
            guard call.route == .issueKey else { return }
            harness.service.keysOfProject[launchIdentifier, default: []].append(harness.service.nextIssuedKey().key)
        }
        await harness.model.issueKey()
        let committed = try #require(harness.service.keysOfProject[launchIdentifier]?.last)
        #expect(harness.model.issuedKey == nil)
        #expect(harness.model.isIssuing == false)
        #expect(harness.model.issueFailure == .unexpected)
        #expect(harness.model.keys == .loaded([launchKey, committed]))
        #expect(harness.service.routes() == [.issueKey, .listKeys])
    }

    @Test func anIssueOfflineSaysTheServerWasUnreachable() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.failures[.issueKey] = .unreachable
        await harness.model.issueKey()
        #expect(harness.model.issueFailure == .unreachable)
        #expect(harness.model.issuedKey == nil)
    }

    @Test func anIssueAnswerAfterTheProjectChangedShowsNoSecretAndNoError() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.suspend(.issueKey)
        let issuing = Task { await harness.model.issueKey() }
        await harness.service.held(.issueKey)
        harness.model.showKeys(projectIdentifier: inboxIdentifier)
        await harness.model.keyLoading?.value
        harness.service.resume(.issueKey)
        await issuing.value
        #expect(harness.model.keyProjectIdentifier == inboxIdentifier)
        #expect(harness.model.issuedKey == nil)
        #expect(harness.model.issueFailure == nil)
        #expect(harness.model.isIssuing == false)
        #expect(harness.model.keys == .loaded([]))
    }

    @Test func anIssueAnswerAfterLeavingTheScreenShowsNoSecret() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.suspend(.issueKey)
        let issuing = Task { await harness.model.issueKey() }
        await harness.service.held(.issueKey)
        harness.model.selectedItem = .today
        harness.service.resume(.issueKey)
        await issuing.value
        expectNoKeyScreen(harness.model)
        #expect(harness.model.isIssuing == false)
    }

    @Test func anIssueAnswerAfterTheSessionEndedShowsNoSecretAndNoError() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.suspend(.issueKey)
        let issuing = Task { await harness.model.issueKey() }
        await harness.service.held(.issueKey)
        await harness.model.signOut()
        harness.service.resume(.issueKey)
        await issuing.value
        expectNoKeyScreen(harness.model)
        #expect(harness.model.phase == .signedOut(notice: nil))
    }

    @Test func leavingThroughTheSidebarForgetsTheSecretAndTheList() async throws {
        let harness = try await keyHarness()
        _ = try await issuedKeyOfLaunch(harness)
        harness.model.selectedItem = .inbox
        expectNoKeyScreen(harness.model)
    }

    @Test func leavingThroughARevealedTaskForgetsTheSecretAndTheList() async throws {
        let harness = try await keyHarness()
        _ = try await issuedKeyOfLaunch(harness)
        harness.model.reveal(task: inboxTask)
        expectNoKeyScreen(harness.model)
        #expect(harness.model.selectedItem == .today)
    }

    @Test func leavingThroughAWidgetLinkForgetsTheSecretAndTheList() async throws {
        let harness = try await keyHarness()
        _ = try await issuedKeyOfLaunch(harness)
        harness.model.follow(.today)
        expectNoKeyScreen(harness.model)
        #expect(harness.model.selectedItem == .today)
    }

    @Test func signingOutForgetsTheSecretAndTheList() async throws {
        let harness = try await keyHarness()
        _ = try await issuedKeyOfLaunch(harness)
        await harness.model.signOut()
        expectNoKeyScreen(harness.model)
    }

    @Test func anEndedSessionTakesTheSignOutPathAndForgetsTheKeys() async throws {
        let harness = try await keyHarness()
        _ = try await issuedKeyOfLaunch(harness)
        harness.service.failures[.listKeys] = .unauthorized
        await harness.model.loadKeys()
        expectNoKeyScreen(harness.model)
        #expect(harness.model.phase == .signedOut(notice: .sessionEnded))
        #expect(harness.vault.secret == nil)
    }

    @Test func switchingWorkspaceFollowsItsInboxAndForgetsTheSecret() async throws {
        let harness = try await keyHarness()
        _ = try await issuedKeyOfLaunch(harness)
        await harness.model.switchWorkspace(identifier: "side")
        await harness.model.keyLoading?.value
        #expect(harness.model.selectedItem == .connectAgent)
        #expect(harness.model.keyProjectIdentifier == sideInboxIdentifier)
        #expect(harness.model.issuedKey == nil)
        #expect(harness.model.keys == .loaded([]))
    }

    @Test func aQuietReloadOfTheSameWorkspaceKeepsTheSecret() async throws {
        let harness = try await keyHarness()
        let issued = try await issuedKeyOfLaunch(harness)
        await harness.model.reloadWorkspacesQuietly()
        #expect(harness.model.issuedKey == issued)
        #expect(harness.model.keyProjectIdentifier == launchIdentifier)
    }

    @Test func revokingRemovesTheKeyAndItsSecret() async throws {
        let harness = try await keyHarness()
        let issued = try await issuedKeyOfLaunch(harness)
        harness.service.calls = []
        harness.service.suspend(.revokeKey)
        let revoking = Task { await harness.model.revokeKey(issued.key) }
        await harness.service.held(.revokeKey)
        #expect(harness.model.revokingKeyIdentifiers == [issued.key.identifier])
        harness.service.resume(.revokeKey)
        await revoking.value
        #expect(harness.model.revokingKeyIdentifiers == [])
        #expect(harness.model.issuedKey == nil)
        #expect(harness.model.keys == .loaded([launchKey]))
        #expect(
            harness.service.calls
                == [.revokeKey(session: harness.session, projectIdentifier: launchIdentifier, keyIdentifier: issued.key.identifier)]
        )
    }

    @Test func aListAnswerStartedBeforeTheRevokeDoesNotBringTheKeyBack() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.suspend(.listKeys)
        let reloading = Task { await harness.model.loadKeys() }
        await harness.service.held(.listKeys)
        await harness.model.revokeKey(launchKey)
        harness.service.keysOfProject[launchIdentifier] = [launchKey]
        harness.service.resume(.listKeys)
        await reloading.value
        #expect(harness.model.keys == .loaded([]))
    }

    @Test func anIssuedKeyRevokedBeforeTheListAnswersIsNotAddedBack() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.suspend(.listKeys)
        let reloading = Task { await harness.model.loadKeys() }
        await harness.service.held(.listKeys)
        await harness.model.issueKey()
        let issued = try #require(harness.model.issuedKey)
        await harness.model.revokeKey(issued.key)
        harness.service.keysOfProject[launchIdentifier] = [launchKey]
        harness.service.resume(.listKeys)
        await reloading.value
        #expect(harness.model.keys == .loaded([launchKey]))
    }

    @Test func revokingAnotherKeyKeepsTheShownSecret() async throws {
        let harness = try await keyHarness()
        let issued = try await issuedKeyOfLaunch(harness)
        await harness.model.revokeKey(launchKey)
        #expect(harness.model.issuedKey == issued)
        #expect(harness.model.keys == .loaded([issued.key]))
    }

    @Test func aKeyAlreadyRevokedLeavesTheListWithoutAnError() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.keysOfProject[launchIdentifier] = []
        await harness.model.revokeKey(launchKey)
        #expect(harness.model.keys == .loaded([]))
        #expect(harness.model.failedRevokeIdentifiers == [])
        #expect(harness.model.revokingKeyIdentifiers == [])
    }

    @Test func aFailedRevokeKeepsTheKeyAndSaysSo() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.failures[.revokeKey] = .unreachable
        await harness.model.revokeKey(launchKey)
        #expect(harness.model.keys == .loaded([launchKey]))
        #expect(harness.model.failedRevokeIdentifiers == [launchKey.identifier])
        harness.service.failures[.revokeKey] = nil
        await harness.model.revokeKey(launchKey)
        #expect(harness.model.failedRevokeIdentifiers == [])
        #expect(harness.model.keys == .loaded([]))
    }

    @Test func aRevokeAnswerAfterTheProjectChangedLeavesTheNewListAlone() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.failures[.revokeKey] = .unreachable
        harness.service.suspend(.revokeKey)
        let revoking = Task { await harness.model.revokeKey(launchKey) }
        await harness.service.held(.revokeKey)
        harness.model.showKeys(projectIdentifier: inboxIdentifier)
        await harness.model.keyLoading?.value
        harness.service.resume(.revokeKey)
        await revoking.value
        #expect(harness.model.keyProjectIdentifier == inboxIdentifier)
        #expect(harness.model.failedRevokeIdentifiers == [])
        #expect(harness.model.revokingKeyIdentifiers == [])
        #expect(harness.model.keys == .loaded([]))
    }

    @Test func aListForAGoneProjectFallsBackToTheInbox() async throws {
        let harness = try await keyHarness()
        harness.service.projectFailures[launchIdentifier] = .notFound
        harness.model.selectedItem = .project(identifier: launchIdentifier)
        harness.model.selectedItem = .connectAgent
        let firstLoading = harness.model.keyLoading
        await firstLoading?.value
        await harness.model.keyLoading?.value
        #expect(harness.model.keyProjectIdentifier == inboxIdentifier)
        #expect(harness.model.keys == .loaded([]))
    }

    @Test func anIssueForAGoneProjectFallsBackToTheInbox() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.failures[.issueKey] = .notFound
        await harness.model.issueKey()
        await harness.model.keyLoading?.value
        #expect(harness.model.keyProjectIdentifier == inboxIdentifier)
        #expect(harness.model.issueFailure == nil)
        #expect(harness.model.keys == .loaded([]))
    }

    @Test func aGoneInboxShowsTheListFailure() async throws {
        let harness = try await keyHarness()
        harness.service.projectFailures[inboxIdentifier] = .notFound
        harness.model.selectedItem = .connectAgent
        await harness.model.keyLoading?.value
        #expect(harness.model.keyProjectIdentifier == inboxIdentifier)
        #expect(harness.model.keys == .failed(.unexpected))
    }

    @Test(arguments: [(OwnerAPIError.unreachable, KeyFailure.unreachable), (.unexpected(status: 500), .unexpected)])
    func aListFailureIsShown(failure: OwnerAPIError, expected: KeyFailure) async throws {
        let harness = try await keyHarness()
        harness.service.failures[.listKeys] = failure
        harness.model.selectedItem = .connectAgent
        await harness.model.keyLoading?.value
        #expect(harness.model.keys == .failed(expected))
    }

    @Test func anUndecodableListIsAnUnexpectedFailure() async throws {
        let harness = try await keyHarness()
        harness.service.undecodableRoutes = [.listKeys]
        harness.model.selectedItem = .connectAgent
        await harness.model.keyLoading?.value
        #expect(harness.model.keys == .failed(.unexpected))
    }

    @Test func aReloadKeepsTheListedKeysUntilItAnswers() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.suspend(.listKeys)
        let reloading = Task { await harness.model.loadKeys() }
        await harness.service.held(.listKeys)
        #expect(harness.model.keys == .loaded([launchKey]))
        harness.service.resume(.listKeys)
        await reloading.value
        #expect(harness.model.keys == .loaded([launchKey]))
    }

    @Test(arguments: [(OwnerAPIError.unreachable, KeyFailure.unreachable), (.unexpected(status: 500), .unexpected)])
    func aFailedReloadKeepsTheListedKeysUnderTheFailure(failure: OwnerAPIError, expected: KeyFailure) async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.failures[.listKeys] = failure
        await harness.model.loadKeys()
        #expect(harness.model.keys == .loaded([launchKey]))
        #expect(harness.model.keyReloadFailure == expected)
        harness.service.failures[.listKeys] = nil
        await harness.model.loadKeys()
        #expect(harness.model.keyReloadFailure == nil)
    }

    @Test func choosingAnotherProjectForgetsTheReloadFailure() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        harness.service.failures[.listKeys] = .unreachable
        await harness.model.loadKeys()
        harness.service.failures[.listKeys] = nil
        harness.model.showKeys(projectIdentifier: inboxIdentifier)
        await harness.model.keyLoading?.value
        #expect(harness.model.keyReloadFailure == nil)
        #expect(harness.model.keys == .loaded([]))
    }

    @Test func refreshingReloadsTheShownKeys() async throws {
        let harness = try await keyHarness()
        await openKeys(harness, from: .project(identifier: launchIdentifier))
        let otherKey = OwnerFixtures.projectKey(identifier: "other-key")
        harness.service.keysOfProject[launchIdentifier] = [launchKey, otherKey]
        await harness.model.refresh()
        #expect(harness.model.keys == .loaded([launchKey, otherKey]))
    }

    @Test func refreshingAwayFromTheKeyScreenListsNoKeys() async throws {
        let harness = try await keyHarness()
        harness.service.calls = []
        await harness.model.refresh()
        #expect(harness.service.routes().contains(.listKeys) == false)
    }

    @Test func aLateListForAProjectNoLongerShownIsDropped() async throws {
        let harness = try await keyHarness()
        harness.service.suspend(.listKeys)
        harness.model.selectedItem = .project(identifier: launchIdentifier)
        harness.model.selectedItem = .connectAgent
        let launchLoading = harness.model.keyLoading
        await harness.service.held(.listKeys)
        harness.model.showKeys(projectIdentifier: inboxIdentifier)
        await harness.service.held(.listKeys, count: 2)
        harness.service.resume(.listKeys)
        await launchLoading?.value
        #expect(harness.model.keyProjectIdentifier == inboxIdentifier)
        #expect(harness.model.keys == .loading)
        harness.service.resume(.listKeys)
        await harness.model.keyLoading?.value
        #expect(harness.model.keys == .loaded([]))
    }

    @Test func theKeyScreenHasNoAddField() async throws {
        let harness = try await keyHarness()
        #expect(harness.model.addTaskDestination(for: .connectAgent) == nil)
    }
}
