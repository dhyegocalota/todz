import Foundation
import Testing
@testable import TodzKit

private let launchIdentifier = "acme-launch"

extension AppModelTests {
    @Test func deletingTheShownWorkspaceShowsTheFirstRemainingOne() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side")
        let home = harness.seedWorkspace(name: "home")
        harness.rememberWorkspace(identifier: "home")
        await harness.signedIn()
        await harness.model.deleteWorkspace(identifier: home.identifier)
        #expect(harness.service.routes().first == .deleteWorkspace)
        #expect(harness.model.workspaces.map(\.identifier) == ["acme", side.identifier])
        #expect(harness.model.phase == .ready)
        #expect(harness.model.activeWorkspace?.identifier == "acme")
        #expect(harness.model.writesInFlight == [])
    }

    @Test func deletingTheLastWorkspaceMovesTheAppToNaming() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        await harness.model.deleteWorkspace(identifier: acme.identifier)
        #expect(harness.model.workspaces == [])
        #expect(harness.model.phase == .naming)
        #expect(harness.model.activeWorkspace == nil)
        #expect(harness.model.banner == nil)
    }

    @Test func deletingAnotherWorkspaceKeepsTheShownOne() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side")
        harness.rememberWorkspace(identifier: "acme")
        await harness.signedIn()
        await harness.model.deleteWorkspace(identifier: side.identifier)
        #expect(harness.model.workspaces == [acme])
        #expect(harness.model.activeWorkspace == acme)
        #expect(harness.model.phase == .ready)
    }

    @Test func aWorkspaceDeleteThatAnswersNotFoundReloadsTheListWithoutABanner() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side")
        harness.rememberWorkspace(identifier: "side")
        await harness.signedIn()
        harness.service.failures[.deleteWorkspace] = .notFound
        harness.service.workspaces = [acme]
        await harness.model.deleteWorkspace(identifier: side.identifier)
        #expect(harness.service.routes().prefix(2) == [.deleteWorkspace, .listWorkspaces])
        #expect(harness.model.workspaces == [acme])
        #expect(harness.model.activeWorkspace == acme)
        #expect(harness.model.banner == nil)
    }

    @Test func aFailedWorkspaceDeleteKeepsTheWorkspaceAndRaisesTheBanner() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        harness.service.failures[.deleteWorkspace] = .unexpected(status: 500)
        await harness.model.deleteWorkspace(identifier: acme.identifier)
        #expect(harness.model.workspaces == [acme])
        #expect(harness.model.activeWorkspace == acme)
        #expect(harness.model.banner == .changeNotSaved)
    }

    @Test func deletingTheSelectedProjectDropsItAndSelectsTheInbox() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        await harness.signedIn()
        harness.model.selectedItem = .project(identifier: launchIdentifier)
        await harness.model.deleteProject(projectIdentifier: launchIdentifier)
        #expect(harness.service.routes().first == .deleteProject)
        #expect(harness.model.activeWorkspace?.projects.map(\.name) == ["Inbox"])
        #expect(harness.model.selectedItem == .inbox)
        #expect(harness.model.projectLoads[launchIdentifier] == nil)
        #expect(harness.store.calls.contains(.eraseProject(identifier: launchIdentifier)))
    }

    @Test func aProjectDeleteThatAnswersNotFoundReloadsTheListWithoutABanner() async throws {
        let harness = try AppModelHarness()
        let workspace = harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        await harness.signedIn()
        harness.service.failures[.deleteProject] = .notFound
        harness.service.workspaces = [Workspace(identifier: workspace.identifier, name: workspace.name, createdAt: workspace.createdAt, projects: [workspace.projects[0]])]
        await harness.model.deleteProject(projectIdentifier: launchIdentifier)
        #expect(harness.service.routes().prefix(2) == [.deleteProject, .listWorkspaces])
        #expect(harness.model.activeWorkspace?.projects.map(\.name) == ["Inbox"])
        #expect(harness.model.banner == nil)
    }

    @Test func aFailedProjectDeleteKeepsTheProjectAndRaisesTheBanner() async throws {
        let harness = try AppModelHarness()
        let workspace = harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        await harness.signedIn()
        harness.service.failures[.deleteProject] = .unexpected(status: 500)
        await harness.model.deleteProject(projectIdentifier: launchIdentifier)
        #expect(harness.model.activeWorkspace == workspace)
        #expect(harness.model.banner == .changeNotSaved)
    }

    @Test func renamingAWorkspaceReplacesItsNameAndKeepsItsProjects() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        await harness.signedIn()
        let renamed = await harness.model.renameWorkspace(identifier: acme.identifier, name: "Acme Inc")
        #expect(renamed?.name == "Acme Inc")
        #expect(harness.model.workspaces.map(\.name) == ["Acme Inc"])
        #expect(harness.model.activeWorkspace?.projects == acme.projects)
        #expect(harness.model.writesInFlight == [])
    }

    @Test func renamingAWorkspaceToAnEmptyNameKeepsTheOldNameAndRaisesTheRuleIssue() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        harness.service.failures[.renameWorkspace] = .ruleViolated(issue: .nameEmpty, index: nil)
        let renamed = await harness.model.renameWorkspace(identifier: acme.identifier, name: "")
        #expect(renamed == nil)
        #expect(harness.model.workspaces == [acme])
        #expect(harness.model.ruleIssues[.workspaceName(workspaceIdentifier: acme.identifier)] == .nameEmpty)
        #expect(harness.model.banner == nil)
    }

    @Test func aPullOfAProjectDeletedElsewhereDropsItsCacheAndReloadsTheList() async throws {
        let harness = try AppModelHarness()
        let workspace = harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        harness.seedTasks(projectIdentifier: launchIdentifier, count: 1)
        harness.rememberWorkspace(identifier: "acme")
        await harness.signedIn()
        harness.service.workspaces = [Workspace(identifier: workspace.identifier, name: workspace.name, createdAt: workspace.createdAt, projects: [workspace.projects[0]])]
        harness.service.projectFailures[launchIdentifier] = .notFound
        await harness.model.pullProject(identifier: launchIdentifier)
        await harness.model.workspaceReload?.value
        #expect(harness.model.activeWorkspace?.projects.map(\.name) == ["Inbox"])
        #expect(harness.model.board.tasks(projectIdentifier: launchIdentifier) == [])
        #expect(harness.store.calls.contains(.eraseProject(identifier: launchIdentifier)))
        #expect(harness.model.banner == nil)
    }
}
