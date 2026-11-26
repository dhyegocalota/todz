import Foundation
import Testing
@testable import TodzKit

private let orderIdentifier = "acme-order"

extension AppModelTests {
    @MainActor private func orderHarness() async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["order"])
        harness.seedTasks(projectIdentifier: orderIdentifier, count: 4)
        await harness.signedIn()
        harness.model.selectedItem = .project(identifier: orderIdentifier)
        return harness
    }

    @Test func aRefreshWithTheServerUnreachableKeepsTheBoardWithNoBanner() async throws {
        let harness = try await orderHarness()
        let boardBefore = harness.model.board
        let loadsBefore = harness.model.projectLoads
        harness.service.failures[.readChanges] = .unreachable
        await harness.model.refresh()
        #expect(harness.model.board == boardBefore)
        #expect(harness.model.projectLoads == loadsBefore)
        #expect(harness.model.banner == nil)
    }

    @Test func aRefreshWhereOneProjectFailsKeepsEveryProjectLoadedWithNoBanner() async throws {
        let harness = try await orderHarness()
        let boardBefore = harness.model.board
        let loadsBefore = harness.model.projectLoads
        harness.service.projectFailures[orderIdentifier] = .unreachable
        await harness.model.refresh()
        #expect(harness.model.board == boardBefore)
        #expect(harness.model.projectLoads == loadsBefore)
        #expect(harness.model.banner == nil)
    }

    @Test func aFirstPullWithTheServerUnreachableRaisesTheNetworkBanner() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side", projectNames: ["garden"])
        harness.rememberWorkspace(identifier: "acme")
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
        harness.rememberWorkspace(identifier: "acme")
        await harness.signedIn()
        harness.service.failures[.readChanges] = .unreachable
        await harness.model.switchWorkspace(identifier: side.identifier)
        #expect(harness.model.loadFailure(of: side) == .network)
    }

    @Test func aWorkspaceWhereOneProjectFailedAndTheOthersWereUnreachableFailsForItsProjects() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side", projectNames: ["garden"])
        harness.rememberWorkspace(identifier: "acme")
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
}
