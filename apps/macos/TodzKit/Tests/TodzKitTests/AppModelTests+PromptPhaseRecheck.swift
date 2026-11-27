import Foundation
import Testing
@testable import TodzKit

extension AppModelTests {
    private func pullCount(_ harness: AppModelHarness, projectIdentifier: String) -> Int {
        harness.service.calls.filter { call in
            guard case let .readChanges(_, identifier, _) = call else { return false }
            return identifier == projectIdentifier
        }.count
    }

    @Test func aSwitchWhoseCurrentWorkspaceVanishedDuringThePromptShowsAndPullsNothing() async throws {
        let harness = try await singleWorkspaceHarness()
        harness.authenticator.isHolding = true
        let opening = Task { await harness.model.switchWorkspace(identifier: "secret") }
        await Task.yield()
        await Task.yield()
        harness.service.workspaces.removeAll { $0.identifier == "acme" }
        await harness.model.reloadWorkspacesQuietly()
        #expect(harness.model.phase == .choosing)
        harness.authenticator.release()
        await opening.value
        #expect(harness.model.phase == .choosing)
        #expect(pullCount(harness, projectIdentifier: "secret-inbox") == 0)
    }

    @Test func aPickerChoiceWhoseListBecameOneWorkspaceDuringThePromptDoesNotShowTwice() async throws {
        let harness = try AppModelHarness(isWorkspaceLockOn: true)
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "secret")
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(harness.model.phase == .choosing)
        harness.authenticator.isHolding = true
        let choosing = Task { await harness.model.chooseWorkspace(identifier: "acme") }
        await Task.yield()
        await Task.yield()
        harness.service.workspaces.removeAll { $0.identifier == "secret" }
        await harness.model.reloadWorkspacesQuietly()
        #expect(harness.model.phase == .ready)
        let pullsBefore = pullCount(harness, projectIdentifier: "acme-inbox")
        harness.authenticator.release()
        await choosing.value
        #expect(pullCount(harness, projectIdentifier: "acme-inbox") == pullsBefore)
    }
}
