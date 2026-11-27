import Foundation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 24)

private func dueToday(_ count: Int, prefix: String) -> [TaskRecord] {
    (1...count).map { MutableTask(number: $0, title: "\(prefix) \($0)", dueDate: today).record }
}

private func storedRequest(projectIdentifier: String, workspaceIdentifier: String?) -> StoredWidgetRequest {
    let request = WidgetRequest(projectIdentifier: projectIdentifier, number: 1, state: .done, at: fixedInstant, workspaceIdentifier: workspaceIdentifier)
    return StoredWidgetRequest(name: "\(UUID().uuidString).json", request: request)
}

extension AppModelTests {
    @MainActor private func lockedHarness(isLockOn: Bool = true, selection: WorkspaceSelection? = nil) async throws -> AppModelHarness {
        let harness = try AppModelHarness(isWorkspaceLockOn: isLockOn)
        let acme = harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        let side = harness.seedWorkspace(name: "secret", projectNames: ["garden"])
        harness.service.tasksOfProject["acme-inbox"] = dueToday(2, prefix: "Acme")
        harness.service.tasksOfProject["secret-inbox"] = dueToday(1, prefix: "Secret")
        harness.store.owner = OwnerCache(
            ownerIdentifier: harness.ownerIdentifier,
            workspaces: [acme, side],
            activeWorkspaceIdentifier: acme.identifier,
            selection: selection
        )
        await harness.signedIn()
        await harness.published()
        return harness
    }

    private var secretKey: TaskKey {
        TaskKey(projectIdentifier: "secret-inbox", number: 1)
    }

    private func pulledProjects(_ harness: AppModelHarness) -> Set<String> {
        Set(harness.service.calls.compactMap { call -> String? in
            guard case let .readChanges(_, projectIdentifier, _) = call else { return nil }
            return projectIdentifier
        })
    }

    @Test func aLaunchWithTheLockOnShowsOnlyTheCurrentWorkspaceAndPresentsTheRestLocked() async throws {
        let harness = try await lockedHarness()
        let model = harness.model
        #expect(model.workspaceLock.isLocked)
        #expect(model.shownWorkspaces.map(\.identifier) == ["acme"])
        #expect(model.presentedWorkspaces.map(\.identifier) == ["acme", "secret"])
        #expect(model.presentedWorkspaces[1] == .locked(identifier: "secret"))
        #expect(model.taskViews?.today.open.map(\.task.title) == ["Acme 1", "Acme 2"])
    }

    @Test func aLaunchRememberingAllCollapsesToTheCurrentAndNeverPullsOrWatchesTheOthers() async throws {
        let harness = try await lockedHarness(selection: .all)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme"])
        #expect(harness.model.selection == .chosen(["acme"]))
        #expect(pulledProjects(harness).isDisjoint(with: ["secret-inbox", "secret-garden"]))
        #expect(!harness.signals.opens.contains(harness.watchKey("secret-inbox")))
        #expect(harness.model.taskViews?.today.open.map(\.task.title) == ["Acme 1", "Acme 2"])
    }

    @Test func theWidgetSnapshotNeverHoldsALockedWorkspace() async throws {
        let harness = try await lockedHarness(selection: .all)
        let snapshot = try #require(harness.widgets.snapshot)
        let rows = snapshot.open + snapshot.pending + snapshot.doneToday
        #expect(snapshot.workspaceName == "acme")
        #expect(rows.map(\.title) == ["Acme 1", "Acme 2"])
        #expect(!String(describing: snapshot).contains("secret"))
        #expect(!String(describing: snapshot).contains("Secret"))
    }

    @Test func withTheLockOffEverythingStaysAsBefore() async throws {
        let harness = try await lockedHarness(isLockOn: false, selection: .all)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "secret"])
        #expect(harness.model.presentedWorkspaces.allSatisfy { if case .visible = $0 { true } else { false } })
        await harness.model.switchWorkspace(identifier: "secret")
        #expect(harness.authenticator.asked.isEmpty)
        #expect(harness.model.activeWorkspace?.identifier == "secret")
    }

    @Test func aRefusedAuthenticationKeepsTheSwitchFromHappeningAndPullsNothing() async throws {
        let harness = try await lockedHarness()
        harness.authenticator.isOwnerAuthenticated = false
        harness.service.calls = []
        await harness.model.switchWorkspace(identifier: "secret")
        #expect(harness.authenticator.asked == [.showWorkspaces(identifiers: ["secret"])])
        #expect(harness.model.activeWorkspace?.identifier == "acme")
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme"])
        #expect(pulledProjects(harness).isEmpty)
        #expect(harness.model.presentedWorkspaces[1] == .locked(identifier: "secret"))
    }

    @Test func authenticatingLetsThePersonSwitchAndShowsTheNames() async throws {
        let harness = try await lockedHarness()
        await harness.model.switchWorkspace(identifier: "secret")
        #expect(harness.model.activeWorkspace?.identifier == "secret")
        #expect(harness.model.taskViews?.today.open.map(\.task.title) == ["Secret 1"])
        #expect(harness.model.presentedWorkspaces.map(\.identifier) == ["acme", "secret"])
        #expect(harness.model.presentedWorkspaces.allSatisfy { if case .visible = $0 { true } else { false } })
        await harness.model.switchWorkspace(identifier: "acme")
        #expect(harness.authenticator.asked.count == 1)
    }

    @Test func theNumberAndStepShortcutsAskBeforeSwitching() async throws {
        let harness = try await lockedHarness()
        harness.authenticator.isOwnerAuthenticated = false
        await harness.model.switchWorkspace(number: 2)
        await harness.model.switchWorkspace(action: .next)
        await harness.model.switchWorkspace(action: .previous)
        #expect(harness.authenticator.asked.count == 3)
        #expect(harness.model.activeWorkspace?.identifier == "acme")
    }

    @Test func selectingAllAndTogglingAnotherWorkspaceAsk() async throws {
        let harness = try await lockedHarness()
        harness.authenticator.isOwnerAuthenticated = false
        await harness.model.selectWorkspaces(.all)
        await harness.model.toggleWorkspace(identifier: "secret")
        #expect(harness.authenticator.asked.count == 2)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme"])
    }

    @Test func choosingFromThePickerAsksAndShowsNoNames() async throws {
        let harness = try AppModelHarness(isWorkspaceLockOn: true)
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "secret")
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(harness.model.phase == .choosing)
        #expect(harness.model.presentedWorkspaces == [.locked(identifier: "acme"), .locked(identifier: "secret")])
        harness.authenticator.isOwnerAuthenticated = false
        await harness.model.chooseWorkspace(identifier: "acme")
        #expect(harness.model.phase == .choosing)
        harness.authenticator.isOwnerAuthenticated = true
        await harness.model.chooseWorkspace(identifier: "acme")
        #expect(harness.model.phase == .ready)
        #expect(harness.model.activeWorkspace?.identifier == "acme")
    }

    @Test func aRelockCollapsesToTheWorkspaceOnScreenAndReleasesTheOthers() async throws {
        let harness = try await lockedHarness()
        await harness.model.selectWorkspaces(.all)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "secret"])
        await harness.model.relockWorkspaces(because: .screenLocked)
        #expect(harness.model.workspaceLock.isLocked)
        #expect(harness.model.selection == .chosen(["acme"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme"])
        #expect(harness.model.taskViews?.today.open.map(\.task.title) == ["Acme 1", "Acme 2"])
        #expect(harness.model.board.tasks(projectIdentifier: "secret-inbox").isEmpty)
        await harness.signals.cancelled(harness.watchKey("secret-inbox"))
        #expect(harness.signals.cancellationCount(of: harness.watchKey("secret-inbox")) == 1)
        #expect(harness.model.presentedWorkspaces[1] == .locked(identifier: "secret"))
    }

    @Test func aRelockErasesTheOtherWorkspacesCachedTasksAndKeepsTheCurrent() async throws {
        let harness = try await lockedHarness()
        await harness.model.selectWorkspaces(.all)
        #expect(harness.store.projects["secret-inbox"] != nil)
        await harness.model.relockWorkspaces(because: .manual)
        #expect(harness.store.projects["secret-inbox"] == nil)
        #expect(harness.store.projects["secret-garden"] == nil)
        #expect(harness.store.projects["acme-inbox"] != nil)
    }

    @Test func aLockedLaunchErasesTheOtherWorkspacesCachedTasksLeftByAnEarlierSession() async throws {
        let harness = try AppModelHarness(isWorkspaceLockOn: true)
        let acme = harness.seedWorkspace(name: "acme")
        let secret = harness.seedWorkspace(name: "secret")
        harness.cache([acme, secret], active: acme)
        harness.cacheTasks(projectIdentifier: "acme-inbox", count: 1, cursor: 1)
        harness.cacheTasks(projectIdentifier: "secret-inbox", count: 1, cursor: 1)
        await harness.signedIn()
        #expect(harness.store.projects["secret-inbox"] == nil)
        #expect(harness.store.projects["acme-inbox"] != nil)
    }

    @Test func aRelockRewritesTheSharedSnapshotFromTheCurrentWorkspaceAndReloadsTheWidgets() async throws {
        let harness = try await lockedHarness()
        await harness.model.selectWorkspaces(.all)
        await harness.published()
        #expect(harness.widgets.snapshot?.open.map(\.title) == ["Acme 1", "Acme 2", "Secret 1"])
        harness.widgets.calls = []
        await harness.model.relockWorkspaces(because: .systemSleep)
        let snapshot = try #require(harness.widgets.snapshot)
        #expect(snapshot.open.map(\.title) == ["Acme 1", "Acme 2"])
        #expect(!String(describing: snapshot).contains("Secret"))
        #expect(harness.widgets.calls.contains(.reload))
    }

    @Test func aRelockAfterSwitchingMakesTheWorkspaceOnScreenTheCurrentOne() async throws {
        let harness = try await lockedHarness()
        await harness.model.switchWorkspace(identifier: "secret")
        await harness.model.relockWorkspaces(because: .screensaverStarted)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["secret"])
        #expect(harness.model.presentedWorkspaces == [.locked(identifier: "acme"), .visible(try #require(harness.model.activeWorkspace))])
        #expect(harness.widgets.snapshot?.workspaceName == "secret")
    }

    @Test func idleBeyondTheTimeoutRelocksThroughTheModel() async throws {
        let harness = try await lockedHarness()
        await harness.model.selectWorkspaces(.all)
        harness.clock.now = harness.clock.now.addingTimeInterval(WorkspaceLockTimeout.standard.seconds)
        await harness.model.relockWorkspacesIfIdle()
        #expect(harness.model.workspaceLock.isLocked)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme"])
    }

    @Test func turningTheSwitchOnCollapsesAtOnceWithoutAsking() async throws {
        let harness = try await lockedHarness(isLockOn: false, selection: .all)
        await harness.model.turnWorkspaceLockOn()
        #expect(harness.authenticator.asked.isEmpty)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme"])
        #expect(harness.lockPreference.isOn)
        #expect(harness.widgets.snapshot?.open.map(\.title) == ["Acme 1", "Acme 2"])
    }

    @Test func turningTheSwitchOffAndChangingTheTimeoutAsk() async throws {
        let harness = try await lockedHarness()
        harness.authenticator.isOwnerAuthenticated = false
        #expect(!(await harness.model.turnWorkspaceLockOff()))
        #expect(!(await harness.model.setWorkspaceLockTimeout(.oneHour)))
        #expect(harness.model.workspaceLock.isEnabled)
        #expect(harness.model.workspaceLock.timeout == .fiveMinutes)
        harness.authenticator.isOwnerAuthenticated = true
        #expect(await harness.model.turnWorkspaceLockOff())
        #expect(!harness.model.workspaceLock.isLocked)
    }

    @Test func aWidgetRequestForALockedWorkspaceIsDroppedAndNothingIsSent() async throws {
        let harness = try await lockedHarness()
        harness.widgets.storedRequests = [
            storedRequest(projectIdentifier: "secret-inbox", workspaceIdentifier: "secret"),
            storedRequest(projectIdentifier: "secret-inbox", workspaceIdentifier: nil),
        ]
        harness.service.calls = []
        await harness.model.takeWidgetRequests()
        await harness.flushed()
        #expect(harness.model.waitingChangeCount == 0)
        #expect(!harness.service.calls.contains { if case .completeTasks = $0 { true } else { false } })
    }

    @Test func anIntentToCompleteATaskOfALockedWorkspaceIsRefusedAndSendsNothing() async throws {
        let harness = try await lockedHarness()
        harness.service.calls = []
        let completion = await harness.model.completeFromShortcut(key: secretKey)
        #expect(completion == .workspaceLocked)
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.service.calls.isEmpty)
    }

    @Test func intentQueriesNeverReturnALockedWorkspacesTasks() async throws {
        let harness = try await lockedHarness(selection: .all)
        #expect(harness.model.shortcutTasks(for: [secretKey]).isEmpty)
        #expect(harness.model.shortcutTasks(matching: "Secret").isEmpty)
        #expect(harness.model.shortcutSuggestedTasks.map(\.title) == ["Acme 1", "Acme 2"])
        #expect(harness.model.shortcutToday?.workspaceName == "acme")
    }

    @Test func anIntentToAddNamesOnlyTheCurrentWorkspace() async throws {
        let harness = try await lockedHarness(selection: .all)
        let addition = await harness.model.addFromShortcut(title: "Buy milk", isDueToday: false)
        #expect(addition == .added(title: "Buy milk", destination: .inbox, workspaceName: "acme", isOffline: false))
    }

    @Test func aLinkToATaskOfALockedWorkspaceOpensTodayAndSaysToUnlock() async throws {
        let harness = try await lockedHarness()
        harness.model.follow(.task(secretKey))
        #expect(harness.model.banner == .workspaceLocked)
        #expect(harness.model.selectedItem == .today)
        #expect(harness.model.selectedTask == nil)
    }

    @Test func aLinkToATaskOfTheCurrentWorkspaceStillOpens() async throws {
        let harness = try await lockedHarness()
        harness.model.follow(.task(TaskKey(projectIdentifier: "acme-inbox", number: 1)))
        #expect(harness.model.banner == nil)
        #expect(harness.model.selectedTask == TaskKey(projectIdentifier: "acme-inbox", number: 1))
    }

    @Test func creatingAndDeletingAWorkspaceAskFirstAndSendNothingWhenRefused() async throws {
        let harness = try await lockedHarness()
        harness.authenticator.isOwnerAuthenticated = false
        harness.service.calls = []
        #expect(await harness.model.createWorkspace(name: "New") == nil)
        await harness.model.deleteWorkspace(identifier: "acme")
        #expect(harness.authenticator.asked == [.createWorkspace, .removeWorkspace])
        #expect(harness.service.calls.isEmpty)
    }

    @Test func renamingOrDeletingInALockedWorkspaceIsRefused() async throws {
        let harness = try await lockedHarness()
        harness.service.calls = []
        #expect(await harness.model.renameWorkspace(identifier: "secret", name: "Peek") == nil)
        #expect(harness.model.banner == .workspaceLocked)
        harness.model.dismissBanner()
        await harness.model.deleteProject(projectIdentifier: "secret-garden")
        #expect(harness.model.banner == .workspaceLocked)
        harness.model.dismissBanner()
        #expect(await harness.model.renameProject(projectIdentifier: "secret-garden", name: "Peek") == nil)
        #expect(harness.model.banner == .workspaceLocked)
        #expect(harness.service.calls.isEmpty)
        #expect(harness.authenticator.asked.isEmpty)
    }

    @Test func aTaskChangeForALockedWorkspaceNeverReachesTheOutbox() async throws {
        let harness = try await lockedHarness()
        await harness.model.complete(task: secretKey)
        await harness.model.addTask(title: "Peek", projectIdentifier: "secret-inbox", dueDate: nil)
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func creatingTheFirstWorkspaceNeedsNoAuthentication() async throws {
        let harness = try AppModelHarness(isWorkspaceLockOn: true)
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(harness.model.phase == .naming)
        let created = await harness.model.createWorkspace(name: "First")
        #expect(created != nil)
        #expect(harness.authenticator.asked.isEmpty)
    }
}
