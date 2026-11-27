import Foundation
import Testing
@testable import TodzKit

extension AppModelTests {
    @MainActor func singleWorkspaceHarness(isLockOn: Bool = true, selection: WorkspaceSelection? = nil, active: String = "acme") async throws -> AppModelHarness {
        let harness = try AppModelHarness(isWorkspaceLockOn: isLockOn)
        let acme = harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        let side = harness.seedWorkspace(name: "secret", projectNames: ["garden"])
        harness.store.owner = OwnerCache(
            ownerIdentifier: harness.ownerIdentifier,
            workspaces: [acme, side],
            activeWorkspaceIdentifier: active,
            selection: selection
        )
        await harness.signedIn()
        await harness.published()
        return harness
    }

    @MainActor func refusing(_ harness: AppModelHarness) {
        harness.authenticator.isOwnerAuthenticated = false
        harness.authenticator.isCancelling = true
    }

    @MainActor private func expectUntouched(_ harness: AppModelHarness) {
        #expect(harness.model.selection == .chosen(["acme"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme"])
        #expect(harness.model.activeWorkspace?.identifier == "acme")
        #expect(harness.model.workspaceLock.isLocked)
    }

    @Test func togglingAnotherWorkspaceWhileLockedIsRefusedWithoutAsking() async throws {
        let harness = try await singleWorkspaceHarness()
        await harness.model.toggleWorkspace(identifier: "secret")
        #expect(harness.authenticator.asked.isEmpty)
        expectUntouched(harness)
    }

    @Test func allWorkspacesAndSeveralWhileLockedAreRefusedWithoutAsking() async throws {
        let harness = try await singleWorkspaceHarness()
        await harness.model.selectWorkspaces(.all)
        await harness.model.selectWorkspaces(.chosen(["acme", "secret"]))
        #expect(harness.authenticator.asked.isEmpty)
        expectUntouched(harness)
    }

    @Test func switchingToAnotherWorkspaceWhileLockedAsksAndSwitchesOnceConfirmed() async throws {
        let harness = try await singleWorkspaceHarness()
        await harness.model.switchWorkspace(identifier: "secret")
        #expect(harness.authenticator.asked == [.switchWorkspaces])
        #expect(harness.model.activeWorkspace?.identifier == "secret")
    }

    @Test func aRefusedSwitchWhileLockedLeavesTheSingleSelection() async throws {
        let harness = try await singleWorkspaceHarness()
        refusing(harness)
        await harness.model.switchWorkspace(identifier: "secret")
        #expect(harness.authenticator.asked == [.switchWorkspaces])
        expectUntouched(harness)
    }

    @Test func theNumberedShortcutAsksWhileLockedAndSwitchesOnceConfirmed() async throws {
        let harness = try await singleWorkspaceHarness()
        await harness.model.switchWorkspace(number: 2)
        #expect(harness.authenticator.asked == [.switchWorkspaces])
        #expect(harness.model.activeWorkspace?.identifier == "secret")
    }

    @Test func theStepShortcutsAskWhileLockedAndAnswerThePromptAloneWhenCancelled() async throws {
        let harness = try await singleWorkspaceHarness()
        refusing(harness)
        await harness.model.switchWorkspace(action: .next)
        await harness.model.switchWorkspace(action: .previous)
        await harness.model.switchWorkspace(number: 2)
        await harness.model.switchWorkspace(number: 9)
        #expect(harness.authenticator.asked.count == 4)
        #expect(Set(harness.authenticator.asked) == [.switchWorkspaces])
        expectUntouched(harness)
    }

    @Test func theNextShortcutAsksWhileLockedAndStepsOnceConfirmed() async throws {
        let harness = try await singleWorkspaceHarness()
        await harness.model.switchWorkspace(action: .next)
        #expect(harness.authenticator.asked == [.switchWorkspaces])
        #expect(harness.model.activeWorkspace?.identifier == "secret")
    }

    @Test func choosingFromTheLockedLaunchPickerAsksAndEntersOnceConfirmed() async throws {
        let harness = try AppModelHarness(isWorkspaceLockOn: true)
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "secret")
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(harness.model.phase == .choosing)
        await harness.model.chooseWorkspaces(.chosen(["acme", "secret"]))
        #expect(harness.model.phase == .choosing)
        await harness.model.chooseWorkspace(identifier: "secret")
        #expect(harness.authenticator.asked == [.switchWorkspaces])
        #expect(harness.model.phase == .ready)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["secret"])
    }

    @Test func aRefusedPickerChoiceKeepsThePicker() async throws {
        let harness = try AppModelHarness(isWorkspaceLockOn: true)
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "secret")
        harness.vault.secret = harness.session
        await harness.model.launch()
        refusing(harness)
        await harness.model.chooseWorkspace(identifier: "acme")
        #expect(harness.authenticator.asked == [.switchWorkspaces])
        #expect(harness.model.phase == .choosing)
    }

    @Test func aConfirmedPromptAsksOnlyOnceForTheNextSelections() async throws {
        let harness = try await singleWorkspaceHarness()
        await harness.model.switchWorkspace(identifier: "secret")
        await harness.model.switchWorkspace(number: 1)
        await harness.model.switchWorkspace(action: .next)
        #expect(harness.authenticator.asked == [.switchWorkspaces])
    }

    @Test func withTheLockOffNoSelectionAsks() async throws {
        let harness = try await singleWorkspaceHarness(isLockOn: false)
        await harness.model.selectWorkspaces(.all)
        await harness.model.toggleWorkspace(identifier: "secret")
        await harness.model.switchWorkspace(number: 2)
        await harness.model.switchWorkspace(action: .previous)
        #expect(harness.authenticator.asked.isEmpty)
    }

    @Test func turningTheSwitchOnCollapsesAMultiSelectionAndTheSnapshotFollows() async throws {
        let harness = try await singleWorkspaceHarness(isLockOn: false, selection: .all)
        await harness.model.turnWorkspaceLockOn()
        #expect(harness.model.selection == .chosen(["acme"]))
        let snapshot = try #require(harness.widgets.snapshot)
        #expect(snapshot.workspaceName == "acme")
        #expect(!String(describing: snapshot).contains("secret"))
    }
}
