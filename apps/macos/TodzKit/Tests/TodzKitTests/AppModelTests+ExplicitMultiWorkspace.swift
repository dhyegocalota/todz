import Foundation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 24)
private let addingGestures: [WorkspaceSwitcherGesture] = [.commandClick, .showAlongside]
private let lockedSet: Set<String> = ["acme", "other"]

private func dueToday(_ count: Int, prefix: String) -> [TaskRecord] {
    (1...count).map { MutableTask(number: $0, title: "\(prefix) \($0)", dueDate: today).record }
}

extension AppModelTests {
    @MainActor private func unlockedSelectionHarness() async throws -> AppModelHarness {
        let harness = try await selectionHarness()
        #expect(await harness.model.beginWorkspaceSwitch())
        return harness
    }

    @MainActor private func lockedSetHarness() async throws -> AppModelHarness {
        let harness = try AppModelHarness(isWorkspaceLockOn: true)
        let acme = harness.seedWorkspace(name: "acme")
        let other = harness.seedWorkspace(name: "other")
        let secret = harness.seedWorkspace(name: "secret")
        harness.service.tasksOfProject["acme-inbox"] = dueToday(1, prefix: "Acme")
        harness.service.tasksOfProject["other-inbox"] = dueToday(1, prefix: "Other")
        harness.service.tasksOfProject["secret-inbox"] = dueToday(1, prefix: "Secret")
        harness.store.owner = OwnerCache(
            ownerIdentifier: harness.ownerIdentifier,
            workspaces: [acme, other, secret],
            activeWorkspaceIdentifier: acme.identifier,
            selection: .chosen(lockedSet)
        )
        harness.cacheTasks(projectIdentifier: "secret-inbox", count: 1, cursor: 1)
        await harness.signedIn()
        await harness.published()
        return harness
    }

    @MainActor private func expectOnlyTheLockedSet(_ harness: AppModelHarness) {
        let snapshot = harness.widgets.snapshot
        #expect(harness.model.workspaceLock.isLocked)
        #expect(harness.model.selection == .chosen(lockedSet))
        #expect(harness.model.visibleWorkspaces.map(\.identifier) == ["acme", "other"])
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "other"])
        #expect(harness.model.taskViews?.today.open.map(\.task.title) == ["Acme 1", "Other 1"])
        #expect(snapshot?.open.map(\.title) == ["Acme 1", "Other 1"])
        #expect(!String(describing: snapshot).contains("secret"))
        #expect(harness.store.projects["secret-inbox"] == nil)
        #expect(harness.model.isLocked(workspaceIdentifier: "secret"))
        #expect(!harness.model.isLocked(workspaceIdentifier: "other"))
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

    @Test(arguments: [false, true])
    func theSwitcherOffersAllAndShowAlongsideOnlyOverSeveralVisibleWorkspaces(isMainWindow: Bool) async throws {
        let harness = try await selectionHarness()
        let locked = WorkspaceChrome(visible: harness.model.visibleWorkspaces, selection: harness.model.selection, isMainWindow: isMainWindow)
        #expect(!locked.showsAllWorkspaces)
        #expect(!locked.showsAlongside)
        #expect(await harness.model.beginWorkspaceSwitch())
        await harness.model.pickWorkspace(identifier: "secret", gesture: .showAlongside)
        let unlocked = WorkspaceChrome(visible: harness.model.visibleWorkspaces, selection: harness.model.selection, isMainWindow: isMainWindow)
        #expect(unlocked.showsAllWorkspaces)
        #expect(unlocked.showsAlongside)
        #expect(unlocked.rows.map(\.isChecked) == [true, true])
    }

    @Test func aLockedLaunchShowsTheLastSelectedSetAndNothingElse() async throws {
        let harness = try await lockedSetHarness()
        expectOnlyTheLockedSet(harness)
        #expect(harness.authenticator.asked.isEmpty)
    }

    @Test func theWidgetSnapshotOfAnUnlockedSessionCarriesTheWholeSelectedSet() async throws {
        let harness = try await unlockedSelectionHarness()
        await harness.model.pickWorkspace(identifier: "secret", gesture: .commandClick)
        await harness.published()
        #expect(harness.widgets.snapshot?.open.map(\.title) == ["Acme 1", "Acme 2", "Secret 1"])
    }

    @Test(arguments: RelockTrigger.allCases)
    func aRelockKeepsTheWholeSelectedSetAndARelaunchOpensItAgain(trigger: RelockTrigger) async throws {
        let harness = try await lockedSetHarness()
        #expect(await harness.model.beginWorkspaceSwitch())
        await harness.model.pickWorkspace(identifier: "secret", gesture: .commandClick)
        await harness.model.pickWorkspace(identifier: "secret", gesture: .commandClick)
        await harness.model.relockWorkspaces(because: trigger)
        expectOnlyTheLockedSet(harness)
        let relaunch = try await relaunched(harness)
        expectOnlyTheLockedSet(relaunch)
    }

    @Test func aRelockOfAllWorkspacesPinsTheSetSoALaterWorkspaceNeverJoinsIt() async throws {
        let harness = try await unlockedSelectionHarness()
        await harness.model.selectWorkspaces(.all)
        await harness.model.relockWorkspaces(because: .manual)
        #expect(harness.model.selection == .chosen(["acme", "secret"]))
        harness.seedWorkspace(name: "later")
        let relaunch = try await relaunched(harness)
        #expect(relaunch.model.visibleWorkspaces.map(\.identifier) == ["acme", "secret"])
        #expect(relaunch.model.shownWorkspaces.map(\.identifier) == ["acme", "secret"])
    }

    @Test func turningTheLockOnKeepsTheSelectedSet() async throws {
        let harness = try await selectionHarness(isLockOn: false)
        await harness.model.selectWorkspaces(.all)
        await harness.model.turnWorkspaceLockOn()
        #expect(harness.model.workspaceLock.isLocked)
        #expect(harness.model.selection == .chosen(["acme", "secret"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "secret"])
    }

    @Test func insideTheLockedSetSwitchingAndRemovingAskNothingAndReAddingAsks() async throws {
        let harness = try await lockedSetHarness()
        await harness.model.pickWorkspace(identifier: "other", gesture: .commandClick)
        #expect(harness.model.selection == .chosen(["acme"]))
        #expect(harness.model.visibleWorkspaces.map(\.identifier) == ["acme"])
        #expect(harness.authenticator.asked.isEmpty)
        refusing(harness)
        await harness.model.pickWorkspace(identifier: "other", gesture: .commandClick)
        #expect(harness.authenticator.asked == [.switchWorkspaces])
        #expect(harness.model.selection == .chosen(["acme"]))
    }

    @Test func switchingToAnotherWorkspaceOfTheLockedSetAsksNothing() async throws {
        let harness = try await lockedSetHarness()
        await harness.model.pickWorkspace(identifier: "other", gesture: .click)
        #expect(harness.authenticator.asked.isEmpty)
        #expect(harness.model.selection == .chosen(["other"]))
        #expect(harness.model.activeWorkspace?.identifier == "other")
    }

    @Test func nothingOutsideTheLockedSetIsReachableWithoutAsking() async throws {
        let harness = try await lockedSetHarness()
        refusing(harness)
        let secretKey = TaskKey(projectIdentifier: "secret-inbox", number: 1)
        let unknownKey = TaskKey(projectIdentifier: "nowhere-inbox", number: 1)
        await harness.model.pickWorkspace(identifier: "secret", gesture: .click)
        await harness.model.pickWorkspace(identifier: "secret", gesture: .commandClick)
        await harness.model.pickWorkspace(identifier: "secret", gesture: .showAlongside)
        await harness.model.selectWorkspaces(.all)
        await harness.model.switchWorkspace(identifier: "secret")
        await harness.model.switchWorkspace(number: 3)
        await harness.model.switchWorkspace(action: .number(3))
        await harness.model.switchWorkspace(action: .next)
        await harness.model.switchWorkspace(action: .previous)
        #expect(!(await harness.model.beginWorkspaceSwitch()))
        harness.model.follow(.task(secretKey))
        let shortcutAnswer = await harness.model.completeFromShortcut(key: secretKey)
        let unknownAnswer = await harness.model.completeFromShortcut(key: unknownKey)
        #expect(shortcutAnswer == unknownAnswer)
        #expect(harness.model.selectedTask == nil)
        #expect(Set(harness.authenticator.asked) == [.switchWorkspaces])
        expectOnlyTheLockedSet(harness)
    }

    @Test func aLockedSetLooksLikeAnAccountWithOnlyThoseWorkspaces() async throws {
        let harness = try await lockedSetHarness()
        let account = try AppModelHarness()
        let acme = account.seedWorkspace(name: "acme")
        let other = account.seedWorkspace(name: "other")
        account.service.tasksOfProject = harness.service.tasksOfProject
        account.store.owner = OwnerCache(ownerIdentifier: account.ownerIdentifier, workspaces: [acme, other], activeWorkspaceIdentifier: acme.identifier, selection: .chosen(lockedSet))
        await account.signedIn()
        let lockedChrome = WorkspaceChrome(visible: harness.model.visibleWorkspaces, selection: harness.model.selection, isMainWindow: true)
        let accountChrome = WorkspaceChrome(visible: account.model.visibleWorkspaces, selection: account.model.selection, isMainWindow: true)
        #expect(lockedChrome == accountChrome)
        #expect(harness.model.taggedWorkspaceName == account.model.taggedWorkspaceName)
        #expect(harness.model.taskViews?.today.open.map(\.task.title) == account.model.taskViews?.today.open.map(\.task.title))
    }
}
