import Foundation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 24)
private let chosenIdentifier = "secret"
private let chosenNumber = 2

enum WorkspaceSelectionPath: CaseIterable, Sendable {
    case switcherRow
    case switchCommand
    case numberedItem
    case numberChord
    case nextChord
    case settingsRow
}

private func dueToday(_ count: Int, prefix: String) -> [TaskRecord] {
    (1...count).map { MutableTask(number: $0, title: "\(prefix) \($0)", dueDate: today).record }
}

extension AppModelTests {
    @MainActor private func selectionHarness(isLockOn: Bool = true) async throws -> AppModelHarness {
        let harness = try AppModelHarness(isWorkspaceLockOn: isLockOn)
        let acme = harness.seedWorkspace(name: "acme")
        let secret = harness.seedWorkspace(name: chosenIdentifier)
        harness.service.tasksOfProject["acme-inbox"] = dueToday(2, prefix: "Acme")
        harness.service.tasksOfProject["secret-inbox"] = dueToday(1, prefix: "Secret")
        harness.cache([acme, secret], active: acme)
        await harness.signedIn()
        await harness.published()
        return harness
    }

    @MainActor private func relaunched(_ harness: AppModelHarness) async throws -> AppModelHarness {
        let kept = try #require(harness.store.owner)
        let relaunch = try AppModelHarness(isWorkspaceLockOn: true)
        relaunch.service.workspaces = harness.service.workspaces
        relaunch.service.tasksOfProject = harness.service.tasksOfProject
        relaunch.store.owner = OwnerCache(
            ownerIdentifier: relaunch.ownerIdentifier,
            workspaces: kept.workspaces,
            activeWorkspaceIdentifier: kept.activeWorkspaceIdentifier,
            selection: kept.selection
        )
        await relaunch.signedIn()
        await relaunch.published()
        return relaunch
    }

    @MainActor private func select(through path: WorkspaceSelectionPath, in harness: AppModelHarness) async {
        switch path {
        case .switcherRow: await harness.model.pickWorkspace(identifier: chosenIdentifier)
        case .switchCommand:
            guard await harness.model.beginWorkspaceSwitch() else { return }
            await harness.model.switchWorkspace(identifier: chosenIdentifier)
        case .numberedItem: await harness.model.switchWorkspace(number: chosenNumber)
        case .numberChord: await harness.model.switchWorkspace(action: .number(chosenNumber))
        case .nextChord: await harness.model.switchWorkspace(action: .next)
        case .settingsRow: await harness.model.switchWorkspace(identifier: chosenIdentifier)
        }
        await harness.published()
    }

    @MainActor private func expectEverySurfaceShowsTheChosenWorkspace(_ harness: AppModelHarness) {
        let snapshot = harness.widgets.snapshot
        #expect(harness.model.selection == .chosen([chosenIdentifier]))
        #expect(harness.model.activeWorkspace?.identifier == chosenIdentifier)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == [chosenIdentifier])
        #expect(harness.model.taskViews?.today.open.map(\.task.title) == ["Secret 1"])
        #expect(snapshot?.workspaceName == chosenIdentifier)
        #expect(snapshot?.open.map(\.title) == ["Secret 1"])
        #expect(harness.store.owner?.activeWorkspaceIdentifier == chosenIdentifier)
    }

    @MainActor private func expectTheChoiceSticks(_ harness: AppModelHarness) async throws {
        expectEverySurfaceShowsTheChosenWorkspace(harness)
        await harness.model.relockWorkspaces(because: .idle)
        #expect(harness.model.workspaceLock.isLocked)
        expectEverySurfaceShowsTheChosenWorkspace(harness)
        let relaunch = try await relaunched(harness)
        #expect(relaunch.model.workspaceLock.isLocked)
        expectEverySurfaceShowsTheChosenWorkspace(relaunch)
    }

    @Test(arguments: WorkspaceSelectionPath.allCases)
    func anotherWorkspaceSelectedInAnUnlockedSessionSticksThroughARelockAndARelaunch(path: WorkspaceSelectionPath) async throws {
        let harness = try await selectionHarness()
        #expect(await harness.model.beginWorkspaceSwitch())
        await select(through: path, in: harness)
        try await expectTheChoiceSticks(harness)
        #expect(harness.authenticator.asked == [.switchWorkspaces])
    }

    @Test(arguments: WorkspaceSelectionPath.allCases)
    func anotherWorkspaceSelectedInALockedSessionAsksOnceAndSticksThroughARelockAndARelaunch(path: WorkspaceSelectionPath) async throws {
        let harness = try await selectionHarness()
        #expect(harness.model.workspaceLock.isLocked)
        await select(through: path, in: harness)
        #expect(harness.authenticator.asked == [.switchWorkspaces])
        try await expectTheChoiceSticks(harness)
    }

    @Test func pickingTheCurrentWorkspaceInTheSwitcherOfALockedSessionNeitherAsksNorMoves() async throws {
        let harness = try await selectionHarness()
        await harness.model.pickWorkspace(identifier: "acme")
        #expect(harness.authenticator.asked.isEmpty)
        #expect(harness.model.selection == .chosen(["acme"]))
        #expect(harness.widgets.snapshot?.workspaceName == "acme")
    }

    @Test func pickingAnotherWorkspaceInTheSwitcherWithTheSwitchOffStillShowsBoth() async throws {
        let harness = try await selectionHarness(isLockOn: false)
        await harness.model.pickWorkspace(identifier: chosenIdentifier)
        #expect(harness.model.selection == .chosen(["acme", chosenIdentifier]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", chosenIdentifier])
        #expect(harness.authenticator.asked.isEmpty)
    }
}
