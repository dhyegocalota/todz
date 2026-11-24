import Foundation
import Testing
@testable import TodzKit

extension AppModelTests {
    @Test func creatingTheFirstWorkspaceOpensItWithItsInboxSelected() async throws {
        let harness = try AppModelHarness()
        await harness.signedIn()
        let inFlight = Captured<Set<WriteTarget>>()
        harness.service.onCall = { call in
            guard call.route == .createWorkspace else { return }
            inFlight.value = harness.model.writesInFlight
        }
        await harness.model.createWorkspace(name: "Acme")
        let created = try #require(harness.service.workspaces.first)
        #expect(inFlight.value == [.newWorkspace])
        #expect(harness.model.writesInFlight == [])
        #expect(harness.model.phase == .ready)
        #expect(harness.model.activeWorkspace == created)
        #expect(harness.model.selectedItem == .inbox)
        #expect(harness.service.routes() == [.createWorkspace, .readChanges])
    }

    @Test func switchingWorkspaceResetsTheBoardAndPullsItsProjectsFromZero() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        let side = harness.seedWorkspace(name: "side", projectNames: ["garden", "house"])
        harness.seedTasks(projectIdentifier: "acme-inbox", count: 2)
        harness.seedTasks(projectIdentifier: "side-garden", count: 1)
        await harness.signedIn()
        harness.model.selectedItem = .project(identifier: "acme-launch")
        await harness.model.switchWorkspace(identifier: side.identifier)
        let pulls = side.projects.map { FakeCall.readChanges(session: harness.session, projectIdentifier: $0.identifier, cursor: 0) }
        #expect(isSameCallSet(harness.service.calls, pulls))
        #expect(harness.model.activeWorkspace == side)
        #expect(harness.model.board.tasks(projectIdentifier: "acme-inbox") == [])
        #expect(harness.model.board.tasks(projectIdentifier: "side-garden").count == 1)
        #expect(harness.model.selectedItem == .inbox)
    }

    @Test func switchingWorkspaceKeepsTheViewKind() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side")
        await harness.signedIn()
        harness.model.selectedItem = .today
        await harness.model.switchWorkspace(identifier: side.identifier)
        #expect(harness.model.selectedItem == .today)
    }

    @Test func switchingWorkspaceByNumberPullsItsProjectsFromZero() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side", projectNames: ["garden"])
        harness.seedTasks(projectIdentifier: "side-garden", count: 1)
        await harness.signedIn()
        await harness.model.switchWorkspace(number: 2)
        let pulls = side.projects.map { FakeCall.readChanges(session: harness.session, projectIdentifier: $0.identifier, cursor: 0) }
        #expect(isSameCallSet(harness.service.calls, pulls))
        #expect(harness.model.activeWorkspace == side)
    }

    @Test func switchingWorkspaceByAnUnlistedNumberChangesNothing() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "side")
        await harness.signedIn()
        await harness.model.switchWorkspace(number: 3)
        #expect(harness.model.activeWorkspace == acme)
        #expect(harness.service.calls == [])
    }

    @Test func switchingWorkspaceByTheActiveNumberMakesNoCall() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "side")
        await harness.signedIn()
        await harness.model.switchWorkspace(number: 1)
        #expect(harness.model.activeWorkspace == acme)
        #expect(harness.service.calls == [])
    }

    @Test func refreshPullsEveryProjectFromItsCursorAndKeepsTheRows() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        harness.seedTasks(projectIdentifier: "acme-inbox", count: 2)
        await harness.signedIn()
        harness.service.failures[.readChanges] = .unreachable
        await harness.model.refresh()
        let pulls: [FakeCall] = [
            .readChanges(session: harness.session, projectIdentifier: "acme-inbox", cursor: 2),
            .readChanges(session: harness.session, projectIdentifier: "acme-launch", cursor: 0),
        ]
        #expect(isSameCallSet(harness.service.calls, pulls))
        #expect(harness.model.taskViews?.inbox.count == 2)
        #expect(harness.model.banner == nil)
    }

    @Test func createProjectAddsItToTheWorkspaceAndSelectsIt() async throws {
        let harness = try AppModelHarness()
        let workspace = harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        let inFlight = Captured<Set<WriteTarget>>()
        harness.service.onCall = { _ in inFlight.value = harness.model.writesInFlight }
        await harness.model.createProject(name: "Launch")
        let created = try #require(harness.model.activeWorkspace?.projects.last)
        #expect(inFlight.value == [.newProject])
        #expect(harness.service.calls == [.createProject(session: harness.session, workspaceIdentifier: workspace.identifier, name: "Launch")])
        #expect(created.name == "Launch")
        #expect(harness.model.selectedItem == .project(identifier: created.identifier))
        #expect(harness.model.projectLoads[created.identifier] == .loaded)
    }

    @Test func renameProjectReplacesItFromTheAnswer() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        await harness.signedIn()
        let target = WriteTarget.projectName(projectIdentifier: "acme-launch")
        let inFlight = Captured<Set<WriteTarget>>()
        harness.service.onCall = { _ in inFlight.value = harness.model.writesInFlight }
        await harness.model.renameProject(projectIdentifier: "acme-launch", name: "Ship")
        #expect(inFlight.value == [target])
        #expect(harness.model.activeWorkspace?.projects.map(\.name) == ["Inbox", "Ship"])
        #expect(harness.model.writesInFlight == [])
    }

    @Test func aFailedProjectWriteLeavesTheWorkspaceUnchanged() async throws {
        let harness = try AppModelHarness()
        let workspace = harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        await harness.signedIn()
        harness.service.failures[.renameProject] = .unexpected(status: 500)
        harness.service.failures[.createProject] = .unexpected(status: 500)
        await harness.model.renameProject(projectIdentifier: "acme-launch", name: "Ship")
        await harness.model.createProject(name: "Other")
        #expect(harness.model.activeWorkspace == workspace)
        #expect(harness.model.banner == .changeNotSaved)
    }

    @Test func renamingTheInboxIsRefused() async throws {
        let harness = try AppModelHarness()
        let workspace = harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        harness.service.failures[.renameProject] = .inboxIsFixed
        await harness.model.renameProject(projectIdentifier: "acme-inbox", name: "Mine")
        #expect(harness.model.activeWorkspace == workspace)
        #expect(harness.model.banner == .inboxIsFixed)
    }

    @Test func aNameRuleIsExposedForTheSheetThatSentIt() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        harness.service.failures[.createProject] = .ruleViolated(issue: .nameTooLong, index: nil)
        await harness.model.createProject(name: String(repeating: "a", count: 81))
        #expect(harness.model.ruleIssues == [.newProject: .nameTooLong])
        #expect(harness.model.banner == nil)
    }
}
