import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let firstTask = TaskKey(projectIdentifier: inboxIdentifier, number: 1)
private let fiveProjectNames = ["one", "two", "three", "four"]

extension AppModelTests {
    @Test func aProjectGoneOnAWriteReloadsTheWorkspaceAndSaysSo() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        await harness.signedIn()
        harness.service.projectFailures["acme-launch"] = .notFound
        await harness.model.renameProject(projectIdentifier: "acme-launch", name: "Ship")
        #expect(harness.model.banner == .projectGone)
        #expect(Array(harness.service.routes().prefix(2)) == [.renameProject, .listWorkspaces])
        #expect(harness.service.routes().dropFirst(2).allSatisfy { $0 == .readChanges })
    }

    @Test func aTaskGoneOnAWriteReloadsTheWorkspaceAndSaysSo() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        await harness.model.complete(task: firstTask)
        #expect(harness.model.banner == .taskGone)
        #expect(harness.service.routes() == [.completeTasks, .listWorkspaces, .readChanges])
    }

    @Test func anUnreachableServerKeepsTheBoardAndRaisesTheNetworkBanner() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 2)
        await harness.signedIn()
        harness.service.failures[.completeTasks] = .unreachable
        let boardBefore = harness.model.board
        await harness.model.complete(task: firstTask)
        #expect(harness.model.board == boardBefore)
        #expect(harness.model.banner == .network)
        harness.service.failures[.completeTasks] = nil
        await harness.model.tryAgain()
        #expect(harness.model.board.task(projectIdentifier: inboxIdentifier, number: 1)?.state == .done)
    }

    @Test func dismissingABannerForgetsItsTryAgain() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 1)
        await harness.signedIn()
        harness.service.failures[.completeTasks] = .unreachable
        await harness.model.complete(task: firstTask)
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
        #expect(harness.model.projectLoads == [inboxIdentifier: .loaded, "acme-alpha": .loaded, "acme-beta": .failed])
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
        harness.service.projectFailures["acme-two"] = .unauthorized
        let callsAtErase = Captured<Int>()
        harness.vault.onErase = { callsAtErase.value = harness.service.calls.count }
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(harness.vault.eraseCount == 1)
        #expect(harness.service.calls.count == callsAtErase.value)
        #expect(harness.model.phase == .signedOut(notice: .sessionEnded))
        #expect(harness.model.board == TaskBoard())
        await harness.model.refresh()
        await harness.model.complete(task: firstTask)
        #expect(harness.service.calls.count == callsAtErase.value)
        #expect(harness.vault.eraseCount == 1)
    }

    @Test func aSessionEndedOnAWriteSignsOutOnceAndStartsNothingMore() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 1)
        await harness.signedIn()
        harness.service.failures[.completeTasks] = .unauthorized
        await harness.model.complete(task: firstTask)
        await harness.model.tryAgain()
        await harness.model.updateTitle(task: firstTask, title: "Renamed")
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
