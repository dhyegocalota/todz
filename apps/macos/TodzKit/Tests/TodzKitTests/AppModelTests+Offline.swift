import Foundation
import Testing
@testable import TodzKit

private let orderIdentifier = "acme-order"
private let addToOrder = WriteTarget.newTask(projectIdentifier: orderIdentifier)

extension AppModelTests {
    @MainActor private func orderHarness() async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["order"])
        harness.seedTasks(projectIdentifier: orderIdentifier, count: 4)
        await harness.signedIn()
        harness.model.selectedItem = .project(identifier: orderIdentifier)
        return harness
    }

    @Test func aRefreshWithTheServerUnreachableKeepsTheBoardAndRaisesTheNetworkBanner() async throws {
        let harness = try await orderHarness()
        let boardBefore = harness.model.board
        let loadsBefore = harness.model.projectLoads
        harness.service.failures[.readChanges] = .unreachable
        await harness.model.refresh()
        #expect(harness.model.board == boardBefore)
        #expect(harness.model.projectLoads == loadsBefore)
        #expect(harness.model.banner == .network)
        #expect(harness.model.canTryAgain)
        harness.service.failures[.readChanges] = nil
        harness.service.calls = []
        await harness.model.tryAgain()
        #expect(harness.service.routes() == [.readChanges, .readChanges])
        #expect(harness.model.banner == nil)
    }

    @Test func aRefreshWhereOneProjectFailsKeepsEveryProjectLoaded() async throws {
        let harness = try await orderHarness()
        let boardBefore = harness.model.board
        let loadsBefore = harness.model.projectLoads
        harness.service.projectFailures[orderIdentifier] = .unreachable
        await harness.model.refresh()
        #expect(harness.model.board == boardBefore)
        #expect(harness.model.projectLoads == loadsBefore)
        #expect(harness.model.banner == .someProjectsFailed)
    }

    @Test func aFirstPullWithTheServerUnreachableRaisesTheNetworkBanner() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side", projectNames: ["garden"])
        await harness.signedIn()
        harness.service.failures[.readChanges] = .unreachable
        await harness.model.switchWorkspace(identifier: side.identifier)
        #expect(harness.model.projectLoads == ["side-inbox": .unreachable, "side-garden": .unreachable])
        #expect(harness.model.banner == .network)
    }

    @Test func aWorkspaceNoneOfWhoseProjectsReachedTheServerFailsForTheNetwork() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side", projectNames: ["garden"])
        await harness.signedIn()
        harness.service.failures[.readChanges] = .unreachable
        await harness.model.switchWorkspace(identifier: side.identifier)
        #expect(harness.model.loadFailure(of: side) == .network)
    }

    @Test func aWorkspaceWhereOneProjectFailedAndTheOthersWereUnreachableFailsForItsProjects() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side", projectNames: ["garden"])
        await harness.signedIn()
        harness.service.projectFailures["side-inbox"] = .unreachable
        harness.service.projectFailures["side-garden"] = .unexpected(status: 500)
        await harness.model.switchWorkspace(identifier: side.identifier)
        #expect(harness.model.projectLoads == ["side-inbox": .unreachable, "side-garden": .failed])
        #expect(harness.model.loadFailure(of: side) == .someProjectsFailed)
    }

    @Test func aWorkspaceWithOneProjectLoadedHasNoLoadFailure() async throws {
        let harness = try AppModelHarness()
        let workspace = harness.seedWorkspace(name: "acme", projectNames: ["order"])
        harness.service.projectFailures[orderIdentifier] = .unreachable
        await harness.signedIn()
        #expect(harness.model.projectLoads == ["acme-inbox": .loaded, orderIdentifier: .unreachable])
        #expect(harness.model.loadFailure(of: workspace) == nil)
    }

    @Test func anAddWhileTheServerIsUnreachableIsWhatTryAgainSendsAfterAFailedRefresh() async throws {
        let harness = try await orderHarness()
        harness.service.failures[.readChanges] = .unreachable
        await harness.model.refresh()
        harness.service.failures[.addTasks] = .unreachable
        await harness.model.addTask(title: "Offline add", projectIdentifier: orderIdentifier, dueDate: nil)
        let draft = TaskDraft(title: "Offline add", notes: nil, dueDate: nil, idempotencyKey: "key-1")
        #expect(harness.model.banner == .network)
        #expect(harness.model.unconfirmedDrafts == [addToOrder: draft])
        harness.service.failures = [:]
        harness.service.calls = []
        await harness.model.tryAgain()
        #expect(harness.service.calls == [.addTasks(session: harness.session, projectIdentifier: orderIdentifier, drafts: [draft])])
        #expect(harness.model.taskViews?.project(identifier: orderIdentifier).count == 5)
        #expect(harness.model.banner == nil)
        #expect(harness.model.unconfirmedDrafts == [:])
    }

    @Test func addingTheSameTitleAgainAfterAFailedAddReusesItsIdempotencyKey() async throws {
        let harness = try await orderHarness()
        harness.service.failures[.addTasks] = .unreachable
        await harness.model.addTask(title: "Offline add", projectIdentifier: orderIdentifier, dueDate: nil)
        harness.service.failures = [:]
        await harness.model.addTask(title: "Offline add", projectIdentifier: orderIdentifier, dueDate: nil)
        await harness.model.addTask(title: "Next", projectIdentifier: orderIdentifier, dueDate: nil)
        #expect(harness.keys.issued == ["key-1", "key-2"])
        #expect(harness.model.unconfirmedDrafts == [:])
    }
}
