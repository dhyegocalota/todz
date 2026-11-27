import Foundation
import Testing
@testable import TodzKit

private let addingGestures: [WorkspaceSwitcherGesture] = [.commandClick, .showAlongside]

extension AppModelTests {
    @MainActor private func unlockedSelectionHarness() async throws -> AppModelHarness {
        let harness = try await selectionHarness()
        #expect(await harness.model.beginWorkspaceSwitch())
        return harness
    }

    @MainActor private func showingBothAfterPickingSecretAlone(_ harness: AppModelHarness) async {
        await harness.model.pickWorkspace(identifier: "secret", gesture: .click)
        await harness.model.pickWorkspace(identifier: "acme", gesture: .commandClick)
        await harness.published()
    }

    @Test func aPlainClickWithTheLockOffShowsThatWorkspaceAloneAndAsksNothing() async throws {
        let harness = try await selectionHarness(isLockOn: false)
        await harness.model.selectWorkspaces(.all)
        await harness.model.pickWorkspace(identifier: "secret", gesture: .click)
        #expect(harness.model.selection == .chosen(["secret"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["secret"])
        #expect(harness.model.activeWorkspace?.identifier == "secret")
        #expect(harness.authenticator.asked.isEmpty)
    }

    @Test(arguments: addingGestures)
    func anAddingGestureWithTheLockOffShowsTheWorkspaceAlongsideAndTakesItOutAgain(gesture: WorkspaceSwitcherGesture) async throws {
        let harness = try await selectionHarness(isLockOn: false)
        await harness.model.pickWorkspace(identifier: "secret", gesture: gesture)
        #expect(harness.model.selection == .chosen(["acme", "secret"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "secret"])
        #expect(harness.model.activeWorkspace?.identifier == "acme")
        #expect(harness.model.taskViews?.today.open.map(\.task.title) == ["Acme 1", "Acme 2", "Secret 1"])
        await harness.model.pickWorkspace(identifier: "secret", gesture: gesture)
        #expect(harness.model.selection == .chosen(["acme"]))
        #expect(harness.authenticator.asked.isEmpty)
    }

    @Test func severalWorkspacesWithTheLockOffSurviveARelaunch() async throws {
        let harness = try await selectionHarness(isLockOn: false)
        await harness.model.pickWorkspace(identifier: "secret", gesture: .commandClick)
        let relaunch = try await relaunched(harness, isLockOn: false)
        #expect(relaunch.model.selection == .chosen(["acme", "secret"]))
        #expect(relaunch.model.shownWorkspaces.map(\.identifier) == ["acme", "secret"])
    }

    @Test(arguments: addingGestures)
    func anAddingGestureWhileLockedAsksOnceThenShowsBoth(gesture: WorkspaceSwitcherGesture) async throws {
        let harness = try await selectionHarness()
        await harness.model.pickWorkspace(identifier: "secret", gesture: gesture)
        #expect(harness.authenticator.asked == [.switchWorkspaces])
        #expect(harness.model.workspaceLock.isUnlocked)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "secret"])
        #expect(harness.model.activeWorkspace?.identifier == "acme")
    }

    @Test(arguments: addingGestures)
    func aRefusedPromptForAnAddingGestureLeavesTheCurrentWorkspaceAlone(gesture: WorkspaceSwitcherGesture) async throws {
        let harness = try await selectionHarness()
        refusing(harness)
        await harness.model.pickWorkspace(identifier: "secret", gesture: gesture)
        #expect(harness.authenticator.asked == [.switchWorkspaces])
        #expect(harness.model.workspaceLock.isLocked)
        #expect(harness.model.selection == .chosen(["acme"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme"])
    }

    @Test func allWorkspacesWhileLockedAsksOnceThenShowsEveryWorkspace() async throws {
        let harness = try await selectionHarness()
        await harness.model.selectWorkspaces(.all)
        #expect(harness.authenticator.asked == [.switchWorkspaces])
        #expect(harness.model.selection == .all)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "secret"])
    }

    @Test(arguments: WorkspaceSelectionPath.allCases)
    func everySelectionPathFromSeveralWorkspacesShowsItsWorkspaceAlone(path: WorkspaceSelectionPath) async throws {
        let harness = try await unlockedSelectionHarness()
        await harness.model.selectWorkspaces(.all)
        await select(through: path, in: harness)
        #expect(harness.model.selection == .chosen(["secret"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["secret"])
        #expect(harness.widgets.snapshot?.workspaceName == "secret")
    }

    @Test func anUnlockedSessionShowingSeveralKeepsTheWidgetOnTheCurrentWorkspaceAlone() async throws {
        let harness = try await unlockedSelectionHarness()
        await showingBothAfterPickingSecretAlone(harness)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "secret"])
        #expect(harness.model.activeWorkspace?.identifier == "secret")
        #expect(harness.widgets.snapshot?.workspaceName == "secret")
        #expect(harness.widgets.snapshot?.open.map(\.title) == ["Secret 1"])
    }

    @Test func aRelockCollapsesSeveralWorkspacesToTheLastOnePickedAlone() async throws {
        let harness = try await unlockedSelectionHarness()
        await showingBothAfterPickingSecretAlone(harness)
        await harness.model.relockWorkspaces(because: .idle)
        #expect(harness.model.selection == .chosen(["secret"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["secret"])
        #expect(harness.model.taskViews?.today.open.map(\.task.title) == ["Secret 1"])
        #expect(harness.widgets.snapshot?.workspaceName == "secret")
        #expect(harness.store.projects["acme-inbox"] == nil)
        let relaunch = try await relaunched(harness)
        #expect(relaunch.model.selection == .chosen(["secret"]))
        #expect(relaunch.model.shownWorkspaces.map(\.identifier) == ["secret"])
    }

    @Test func aLockedRelaunchOfSeveralWorkspacesOpensTheLastOnePickedAlone() async throws {
        let harness = try await unlockedSelectionHarness()
        await showingBothAfterPickingSecretAlone(harness)
        let relaunch = try await relaunched(harness)
        #expect(relaunch.model.workspaceLock.isLocked)
        #expect(relaunch.model.selection == .chosen(["secret"]))
        #expect(relaunch.model.shownWorkspaces.map(\.identifier) == ["secret"])
        #expect(relaunch.widgets.snapshot?.workspaceName == "secret")
    }
}
