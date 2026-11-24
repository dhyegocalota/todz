import Foundation
import Testing
@testable import TodzKit

extension AppModelTests {
    @Test func createWorkspaceAnswersTheCreatedWorkspace() async throws {
        let harness = try AppModelHarness()
        await harness.signedIn()
        let created = await harness.model.createWorkspace(name: "Acme")
        #expect(created == harness.service.workspaces.first)
        #expect(created != nil)
    }

    @Test func createProjectAnswersTheCreatedProject() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        let created = await harness.model.createProject(name: "Launch")
        #expect(created == harness.model.activeWorkspace?.projects.last)
        #expect(created?.name == "Launch")
    }

    @Test func renameProjectAnswersTheRenamedProject() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        await harness.signedIn()
        let renamed = await harness.model.renameProject(projectIdentifier: "acme-launch", name: "Ship")
        #expect(renamed?.identifier == "acme-launch")
        #expect(renamed?.name == "Ship")
    }

    @Test func aRefusedWorkspaceOrProjectWriteAnswersNothing() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        await harness.signedIn()
        harness.service.failures[.createWorkspace] = .unreachable
        harness.service.failures[.createProject] = .ruleViolated(issue: .nameEmpty, index: nil)
        harness.service.failures[.renameProject] = .unexpected(status: 500)
        #expect(await harness.model.createWorkspace(name: "Side") == nil)
        #expect(await harness.model.createProject(name: " ") == nil)
        #expect(await harness.model.renameProject(projectIdentifier: "acme-launch", name: "Ship") == nil)
    }
}
