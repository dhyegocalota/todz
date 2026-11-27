import Foundation
import Testing
@testable import TodzKit

extension AppModelTests {
    @MainActor private func cachedLaunch(isLockOn: Bool = false, selection: WorkspaceSelection? = nil, listed: [String] = ["acme", "side", "third"]) async throws -> AppModelHarness {
        let harness = try AppModelHarness(isWorkspaceLockOn: isLockOn)
        let cached = ["acme", "side", "third"].map { harness.seedWorkspace(name: $0) }
        harness.service.workspaces = harness.service.workspaces.filter { listed.contains($0.identifier) }
        harness.store.owner = OwnerCache(ownerIdentifier: harness.ownerIdentifier, workspaces: cached, activeWorkspaceIdentifier: "side", selection: selection)
        await harness.signedIn()
        return harness
    }

    @Test func aLaunchFromACacheOfSeveralWorkspacesReopensTheRememberedOne() async throws {
        let harness = try await cachedLaunch()
        #expect(harness.model.phase == .ready)
        #expect(harness.model.activeWorkspace?.identifier == "side")
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["side"])
    }

    @Test func aLaunchReopensTheRememberedOneAfterItWasStoredByAnEarlierLaunch() async throws {
        let first = try await cachedLaunch()
        let second = try AppModelHarness()
        ["acme", "side", "third"].forEach { second.seedWorkspace(name: $0) }
        let stored = try #require(first.store.owner)
        second.store.owner = OwnerCache(ownerIdentifier: second.ownerIdentifier, workspaces: stored.workspaces, activeWorkspaceIdentifier: stored.activeWorkspaceIdentifier, selection: stored.selection)
        await second.signedIn()
        #expect(second.model.phase == .ready)
        #expect(second.model.activeWorkspace?.identifier == "side")
    }

    @Test func aLaunchReopensARememberedSelectionOfSeveralWorkspaces() async throws {
        let harness = try await cachedLaunch(selection: .chosen(["acme", "side"]))
        #expect(harness.model.phase == .ready)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "side"])
    }

    @Test func aLaunchWhoseRememberedWorkspaceWasDeletedOnTheServerOpensThePicker() async throws {
        let harness = try await cachedLaunch(listed: ["acme", "third"])
        #expect(harness.model.phase == .choosing)
        #expect(harness.model.activeWorkspace == nil)
    }

    @Test func aLockedLaunchOpensTheRememberedSetPinned() async throws {
        let harness = try await cachedLaunch(isLockOn: true, selection: .all)
        #expect(harness.model.phase == .ready)
        #expect(harness.model.selection == .chosen(["acme", "side", "third"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "side", "third"])
    }
}
