import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let firstTask = TaskKey(projectIdentifier: inboxIdentifier, number: 1)
private let fiveProjectNames = ["one", "two", "three", "four"]

extension AppModelTests {
    @Test func aProjectGoneOnAWriteReloadsTheWorkspaceAndSaysSo() async throws {
        let harness = try AppModelHarness()
        let workspace = harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        await harness.signedIn()
        harness.model.selectedItem = .project(identifier: "acme-launch")
        harness.service.failures[.renameProject] = .notFound
        let remaining = Workspace(identifier: workspace.identifier, name: workspace.name, createdAt: workspace.createdAt, projects: [workspace.projects[0]])
        harness.service.workspaces = [remaining]
        await harness.model.renameProject(projectIdentifier: "acme-launch", name: "Ship")
        #expect(harness.model.banner == .projectGone)
        #expect(harness.service.routes() == [.renameProject, .listWorkspaces, .readChanges])
        #expect(harness.model.activeWorkspace == remaining)
        #expect(harness.model.selectedItem == .inbox)
    }

    @Test func aWorkspaceGoneOnAWriteReloadsTheWorkspacesAndSaysSo() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side")
        harness.rememberWorkspace(identifier: "acme")
        await harness.signedIn()
        harness.service.failures[.createProject] = .notFound
        harness.service.workspaces = [side]
        await harness.model.createProject(name: "Launch")
        #expect(harness.model.banner == .workspaceGone)
        #expect(harness.service.routes() == [.createProject, .listWorkspaces, .readChanges])
        #expect(harness.model.activeWorkspace == side)
    }

    @Test func aWorkspaceGoneWhoseReloadCannotReachTheServerRaisesTheNetworkBanner() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        harness.service.failures[.createProject] = .notFound
        harness.service.failures[.listWorkspaces] = .unreachable
        await harness.model.createProject(name: "Launch")
        #expect(harness.model.banner == .network)
        #expect(harness.model.canTryAgain)
        #expect(harness.service.routes() == [.createProject, .listWorkspaces])
    }

    @Test func aWorkspaceGoneWhoseReloadEndsTheSessionSignsOutWithNoBanner() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        harness.service.failures[.createProject] = .notFound
        harness.service.failures[.listWorkspaces] = .unauthorized
        await harness.model.createProject(name: "Launch")
        #expect(harness.model.phase == .signedOut(notice: .sessionEnded))
        #expect(harness.model.banner == nil)
        #expect(harness.vault.eraseCount == 1)
    }

    @Test func dismissingABannerForgetsItsTryAgain() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        harness.service.failures[.createProject] = .unreachable
        await harness.model.createProject(name: "Launch")
        #expect(harness.model.canTryAgain)
        harness.model.dismissBanner()
        #expect(harness.model.banner == nil)
        #expect(harness.model.canTryAgain == false)
    }

    @Test func aPullWhereOneOfThreeProjectsFailsShowsTheOtherTwoAndTriesAgainOnlyThatOne() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["alpha", "beta"])
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 1)
        harness.seedTasks(projectIdentifier: "acme-alpha", count: 2)
        harness.seedTasks(projectIdentifier: "acme-beta", count: 3)
        harness.service.projectFailures["acme-beta"] = .unreachable
        await harness.signedIn()
        #expect(harness.model.phase == .ready)
        #expect(harness.model.taskViews?.inbox.count == 1)
        #expect(harness.model.taskViews?.project(identifier: "acme-alpha").count == 2)
        #expect(harness.model.taskViews?.project(identifier: "acme-beta") == [])
        #expect(harness.model.projectLoads == [inboxIdentifier: .loaded, "acme-alpha": .loaded, "acme-beta": .unreachable])
        #expect(harness.model.banner == .someProjectsFailed)
        harness.service.projectFailures["acme-beta"] = nil
        await harness.model.tryAgain()
        #expect(harness.service.calls == [.readChanges(session: harness.session, projectIdentifier: "acme-beta", cursor: 0)])
        #expect(harness.model.taskViews?.project(identifier: "acme-beta").count == 3)
        #expect(harness.model.projectLoads["acme-beta"] == .loaded)
        #expect(harness.model.banner == nil)
    }

    @Test func aSessionEndedInTheMiddleOfAPullOfFiveProjectsSignsOutOnce() async throws {
        let harness = try AppModelHarness()
        let workspace = harness.seedWorkspace(name: "acme", projectNames: fiveProjectNames)
        workspace.projects.forEach { harness.seedTasks(projectIdentifier: $0.identifier, count: 3) }
        harness.service.pageSize = 1
        harness.service.suspend(.readChanges)
        harness.vault.secret = harness.session
        let launching = Task { await harness.model.launch() }
        await harness.service.held(.readChanges, count: AppModel.pullConcurrencyLimit)
        let callsBeforeTheFirstUnauthorized = harness.service.calls
        harness.service.failures[.readChanges] = .unauthorized
        harness.service.unsuspend(.readChanges)
        workspace.projects.forEach { _ in harness.service.resume(.readChanges) }
        await launching.value
        #expect(harness.vault.eraseCount == 1)
        #expect(harness.service.calls == callsBeforeTheFirstUnauthorized)
        #expect(harness.model.phase == .signedOut(notice: .sessionEnded))
        #expect(harness.model.board == TaskBoard())
        await harness.model.refresh()
        await harness.model.complete(task: firstTask)
        #expect(harness.service.calls == callsBeforeTheFirstUnauthorized)
        #expect(harness.vault.eraseCount == 1)
    }

    @Test func aSessionEndedOnAWriteSignsOutOnceAndStartsNothingMore() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 1)
        await harness.signedIn()
        harness.service.failures[.completeTasks] = .unauthorized
        await harness.model.complete(task: firstTask)
        await harness.flushed()
        await harness.model.tryAgain()
        await harness.model.updateTitle(task: firstTask, title: "Renamed")
        await harness.flushed()
        #expect(harness.service.routes() == [.completeTasks])
        #expect(harness.vault.eraseCount == 1)
        #expect(harness.model.phase == .signedOut(notice: .sessionEnded))
        #expect(harness.model.banner == nil)
    }

    @Test func aSessionEndedAtLaunchSignsOutWithTheNotice() async throws {
        let harness = try AppModelHarness()
        harness.service.failures[.updateOwner] = .unauthorized
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(harness.service.routes() == [.updateOwner])
        #expect(harness.vault.eraseCount == 1)
        #expect(harness.model.phase == .signedOut(notice: .sessionEnded))
    }

    @Test func anUnreachableServerAtLaunchKeepsLoadingWithTryAgain() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.service.failures[.listWorkspaces] = .unreachable
        await harness.signedIn()
        #expect(harness.model.phase == .loading)
        #expect(harness.model.banner == .network)
        harness.service.failures[.listWorkspaces] = nil
        await harness.model.tryAgain()
        #expect(harness.model.phase == .ready)
    }
}
