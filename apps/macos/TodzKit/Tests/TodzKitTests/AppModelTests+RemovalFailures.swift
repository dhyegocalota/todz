import Foundation
import Testing
@testable import TodzKit

extension AppModelTests {
    @Test func deletingOneOfTwoShownWorkspacesLeavesTheSurvivorAsTheWholeState() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        harness.seedWorkspace(name: "side", projectNames: ["garden"])
        harness.seedTasks(projectIdentifier: "acme-inbox", count: 2)
        harness.seedTasks(projectIdentifier: "side-inbox", count: 1)
        harness.rememberWorkspace(identifier: "acme")
        await harness.signedIn()
        await harness.model.selectWorkspaces(.chosen(["acme", "side"]))
        harness.model.selectedItem = .project(identifier: "acme-launch")
        await harness.model.deleteWorkspace(identifier: "acme")
        #expect(harness.model.selection == .chosen(["side"]))
        #expect(harness.model.activeWorkspaceIdentifier == "side")
        #expect(harness.model.selectedItem == .inbox)
        #expect(harness.model.projectLoads.keys.sorted() == ["side-garden", "side-inbox"])
        #expect(harness.model.board.tasks(projectIdentifier: "acme-inbox") == [])
    }

    @Test func aWorkspaceDeleteWhoseReloadFailsStillDropsTheWorkspace() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side")
        harness.rememberWorkspace(identifier: "acme")
        await harness.signedIn()
        harness.service.failures[.listWorkspaces] = .unreachable
        await harness.model.deleteWorkspace(identifier: side.identifier)
        #expect(harness.model.workspaces.map(\.identifier) == ["acme"])
        #expect(harness.model.banner == nil)
    }

    @Test func aProjectDeleteWhoseReloadFailsStillDropsTheProject() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        await harness.signedIn()
        harness.service.failures[.listWorkspaces] = .unreachable
        await harness.model.deleteProject(projectIdentifier: "acme-launch")
        #expect(harness.model.workspaces.flatMap(\.projects).map(\.identifier) == ["acme-inbox"])
        #expect(harness.model.banner == nil)
    }

    @Test func deletingTheInboxIsRefusedWithTheFixedInboxBanner() async throws {
        let harness = try AppModelHarness()
        let workspace = harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        harness.service.failures[.deleteProject] = .inboxIsFixed
        await harness.model.deleteProject(projectIdentifier: "acme-inbox")
        #expect(harness.model.workspaces == [workspace])
        #expect(harness.model.banner == .inboxIsFixed)
    }
}
