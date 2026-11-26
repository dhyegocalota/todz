import Foundation
import Testing
@testable import TodzKit

extension AppModelTests {
    @Test func signingInWithTwoWorkspacesAndNoRememberedChoiceOpensThePicker() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "side")
        await harness.signedIn()
        #expect(harness.model.phase == .choosing)
        #expect(harness.model.activeWorkspace == nil)
        #expect(harness.model.workspaces.map(\.identifier) == ["acme", "side"])
    }

    @Test func signingInWithOneWorkspaceOpensIt() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        #expect(harness.model.phase == .ready)
        #expect(harness.model.activeWorkspace == acme)
    }

    @Test func signingInWithNoWorkspaceNamesTheFirstOne() async throws {
        let harness = try AppModelHarness()
        await harness.signedIn()
        #expect(harness.model.phase == .naming)
    }

    @Test func signingInOpensTheRememberedWorkspaceWithoutThePicker() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side")
        harness.rememberWorkspace(identifier: side.identifier)
        await harness.signedIn()
        #expect(harness.model.phase == .ready)
        #expect(harness.model.activeWorkspace == side)
    }

    @Test func aRememberedWorkspaceThatIsNoLongerListedOpensThePicker() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "side")
        harness.rememberWorkspace(identifier: "gone")
        await harness.signedIn()
        #expect(harness.model.phase == .choosing)
        #expect(harness.model.activeWorkspace == nil)
    }

    @Test func choosingAWorkspaceOpensItAndPullsItsProjectsFromZero() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side", projectNames: ["garden"])
        harness.seedTasks(projectIdentifier: "side-garden", count: 1)
        await harness.signedIn()
        await harness.model.chooseWorkspace(identifier: side.identifier)
        let pulls = side.projects.map { FakeCall.readChanges(session: harness.session, projectIdentifier: $0.identifier, cursor: 0) }
        #expect(harness.model.phase == .ready)
        #expect(harness.model.activeWorkspace == side)
        #expect(isSameCallSet(harness.service.calls, pulls))
        #expect(harness.model.selectedItem == .inbox)
    }

    @Test func choosingAnUnlistedWorkspaceChangesNothing() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "side")
        await harness.signedIn()
        await harness.model.chooseWorkspace(identifier: "unknown")
        #expect(harness.model.phase == .choosing)
        #expect(harness.model.activeWorkspace == nil)
        #expect(harness.service.calls == [])
    }

    @Test func choosingOutsideThePickerChangesNothing() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "side")
        harness.rememberWorkspace(identifier: acme.identifier)
        await harness.signedIn()
        await harness.model.chooseWorkspace(identifier: "side")
        #expect(harness.model.phase == .ready)
        #expect(harness.model.activeWorkspace == acme)
    }

    @Test func aWorkspaceCountsItsNamedProjectsWithoutTheInbox() {
        let workspace = Workspace(identifier: "acme", name: "acme", createdAt: fixedInstant, projects: [
            Project(identifier: "acme-inbox", name: "Inbox", isInbox: true, createdAt: fixedInstant),
            Project(identifier: "acme-launch", name: "launch", isInbox: false, createdAt: fixedInstant),
        ])
        #expect(workspace.namedProjectCount == 1)
    }

    @Test func whileChoosingTheWidgetsAreAbsent() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "side")
        await harness.signedIn()
        #expect(harness.model.widgetSnapshot == .absent)
    }
}
