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

    @Test func aLaunchWithTheLockOnShowsOnlyTheCurrentWorkspace() async throws {
        let harness = try await lockedHarness()
        let model = harness.model
        #expect(model.workspaceLock.isLocked)
        #expect(model.shownWorkspaces.map(\.identifier) == ["acme"])
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
        #expect(harness.model.visibleWorkspaces.count == 2)
        await harness.model.switchWorkspace(identifier: "secret")
        #expect(harness.authenticator.asked.isEmpty)
        #expect(harness.model.activeWorkspace?.identifier == "secret")
    }

    @Test func afterTheSwitchPromptThePersonSwitchesAndSeesTheNames() async throws {
        let harness = try await lockedHarness()
        #expect(await harness.model.beginWorkspaceSwitch())
        await harness.model.switchWorkspace(identifier: "secret")
        #expect(harness.model.activeWorkspace?.identifier == "secret")
        #expect(harness.model.taskViews?.today.open.map(\.task.title) == ["Secret 1"])
        #expect(harness.model.visibleWorkspaces.map(\.identifier) == ["acme", "secret"])
        await harness.model.switchWorkspace(identifier: "acme")
        #expect(harness.authenticator.asked == [.switchWorkspaces])
    }

    @Test func thePickerOfALockedLaunchStaysEmptyUntilThePromptIsConfirmed() async throws {
        let harness = try AppModelHarness(isWorkspaceLockOn: true)
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "secret")
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(harness.model.phase == .choosing)
        #expect(harness.model.visibleWorkspaces.isEmpty)
        await harness.model.chooseWorkspace(identifier: "acme")
        #expect(harness.model.phase == .choosing)
        #expect(harness.authenticator.asked.isEmpty)
        #expect(await harness.model.beginWorkspaceSwitch())
        #expect(harness.model.visibleWorkspaces.map(\.identifier) == ["acme", "secret"])
        await harness.model.chooseWorkspace(identifier: "acme")
        #expect(harness.model.phase == .ready)
        #expect(harness.model.activeWorkspace?.identifier == "acme")
    }

    @Test func aRelockCollapsesToTheWorkspaceOnScreenAndReleasesTheOthers() async throws {
        let harness = try await lockedHarness()
        _ = await harness.model.beginWorkspaceSwitch()
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
        #expect(harness.model.visibleWorkspaces.map(\.identifier) == ["acme"])
    }

    @Test func aRelockErasesTheOtherWorkspacesCachedTasksAndKeepsTheCurrent() async throws {
        let harness = try await lockedHarness()
        _ = await harness.model.beginWorkspaceSwitch()
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

    @Test func anUnlockedSessionNeverWidensTheSharedSnapshot() async throws {
        let harness = try await lockedHarness()
        _ = await harness.model.beginWorkspaceSwitch()
        await harness.model.selectWorkspaces(.all)
        await harness.published()
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "secret"])
        let snapshot = try #require(harness.widgets.snapshot)
        #expect(snapshot.workspaceName == "acme")
        #expect(snapshot.open.map(\.title) == ["Acme 1", "Acme 2"])
        #expect(!String(describing: snapshot).contains("Secret"))
    }

    @Test func terminatingWritesTheCurrentWorkspaceAndReloadsTheTimelines() async throws {
        let harness = try await lockedHarness()
        _ = await harness.model.beginWorkspaceSwitch()
        await harness.model.selectWorkspaces(.all)
        harness.widgets.snapshot = nil
        harness.widgets.calls = []
        harness.model.prepareWidgetsForTermination()
        #expect(harness.widgets.snapshot?.open.map(\.title) == ["Acme 1", "Acme 2"])
        #expect(harness.widgets.calls.contains(.reload))
    }

    @Test func inputAfterTheTimeoutRelocksAndCollapsesTheModel() async throws {
        let harness = try await lockedHarness()
        _ = await harness.model.beginWorkspaceSwitch()
        await harness.model.selectWorkspaces(.all)
        harness.clock.now = harness.clock.now.addingTimeInterval(WorkspaceLockTimeout.standard.seconds)
        harness.model.noteWorkspaceLockInput()
        #expect(harness.model.workspaceLock.isLocked)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme"])
        await harness.model.workspaceRelock?.value
        #expect(harness.model.selection == .chosen(["acme"]))
    }

    @Test func aCurrentWorkspaceThatVanishedWhileLockedShowsNothingAndGoesToThePickerWhichAsks() async throws {
        let harness = try AppModelHarness(isWorkspaceLockOn: true)
        let acme = harness.seedWorkspace(name: "acme")
        let secret = harness.seedWorkspace(name: "secret")
        harness.service.tasksOfProject["secret-inbox"] = dueToday(1, prefix: "Secret")
        harness.cache([acme, secret], active: acme)
        harness.service.workspaces.removeAll { $0.identifier == "acme" }
        await harness.signedIn()
        #expect(harness.model.phase == .choosing)
        #expect(harness.model.shownWorkspaces.isEmpty)
        #expect(harness.model.taskViews == nil)
        #expect(harness.model.visibleWorkspaces.isEmpty)
        #expect(pulledProjects(harness).isEmpty)
        await harness.model.chooseWorkspace(identifier: "secret")
        #expect(harness.model.phase == .choosing)
        harness.authenticator.isOwnerAuthenticated = false
        #expect(!(await harness.model.beginWorkspaceSwitch()))
        #expect(harness.model.visibleWorkspaces.isEmpty)
        #expect(harness.authenticator.asked == [.switchWorkspaces])
    }

    @Test func aRelockRewritesTheSharedSnapshotFromTheCurrentWorkspaceAndReloadsTheWidgets() async throws {
        let harness = try await lockedHarness()
        _ = await harness.model.beginWorkspaceSwitch()
        await harness.model.selectWorkspaces(.all)
        await harness.published()
        #expect(harness.widgets.snapshot?.open.map(\.title) == ["Acme 1", "Acme 2"])
        harness.widgets.snapshot = nil
        harness.widgets.calls = []
        await harness.model.relockWorkspaces(because: .systemSleep)
        let snapshot = try #require(harness.widgets.snapshot)
        #expect(snapshot.open.map(\.title) == ["Acme 1", "Acme 2"])
        #expect(!String(describing: snapshot).contains("Secret"))
        #expect(harness.widgets.calls.contains(.reload))
    }

    @Test func aRelockAfterSwitchingMakesTheWorkspaceOnScreenTheCurrentOne() async throws {
        let harness = try await lockedHarness()
        _ = await harness.model.beginWorkspaceSwitch()
        await harness.model.switchWorkspace(identifier: "secret")
        await harness.model.relockWorkspaces(because: .screensaverStarted)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["secret"])
        #expect(harness.model.visibleWorkspaces.map(\.identifier) == ["secret"])
        #expect(harness.widgets.snapshot?.workspaceName == "secret")
    }

    @Test func idleBeyondTheTimeoutRelocksThroughTheModel() async throws {
        let harness = try await lockedHarness()
        _ = await harness.model.beginWorkspaceSwitch()
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
        #expect(completion == .notFound)
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

    @Test func aLinkToATaskOfALockedWorkspaceOpensTodayAndAnswersAsAnUnknownProjectDoes() async throws {
        let harness = try await lockedHarness()
        harness.model.follow(.task(secretKey))
        #expect(harness.model.banner == nil)
        #expect(harness.model.selectedItem == .today)
        #expect(harness.model.selectedTask == nil)
    }

    @Test func aLinkToALockedWorkspaceAnswersExactlyAsALinkToAnUnknownProjectDoes() async throws {
        let locked = try await lockedHarness()
        let unknown = try await lockedHarness()
        locked.model.follow(.task(secretKey))
        unknown.model.follow(.task(TaskKey(projectIdentifier: "nowhere-inbox", number: 1)))
        #expect(locked.model.banner == unknown.model.banner)
        #expect(locked.model.selectedItem == unknown.model.selectedItem)
        #expect(locked.model.selectedTask == unknown.model.selectedTask)
    }

    @Test func theConnectedAppsOfALockedWorkspaceAreHiddenWhileTheLockIsOn() async throws {
        let harness = try await lockedHarness()
        harness.service.connectedApps = [
            ConnectedAppFixtures.connectedApp(identifier: "owner-wide", createdAtMilliseconds: OwnerFixtures.createdAtMilliseconds),
            ConnectedAppFixtures.projectScoped(identifier: "in-acme", projectIdentifier: "acme-launch"),
            ConnectedAppFixtures.projectScoped(identifier: "in-secret", projectIdentifier: "secret-garden")
        ]
        await harness.model.loadConnectedApps()
        #expect(harness.model.visibleConnectedApps.map(\.identifier).sorted() == ["in-acme", "owner-wide"])
    }

    @Test func aConnectedAppOfAProjectThisMacDoesNotKnowIsHiddenWhileTheLockIsOn() async throws {
        let harness = try await lockedHarness()
        harness.service.connectedApps = [
            ConnectedAppFixtures.projectScoped(identifier: "in-acme", projectIdentifier: "acme-launch"),
            ConnectedAppFixtures.projectScoped(identifier: "in-unknown", projectIdentifier: "made-by-an-agent")
        ]
        await harness.model.loadConnectedApps()
        #expect(harness.model.visibleConnectedApps.map(\.identifier) == ["in-acme"])
    }

    @Test func withoutTheLockEveryConnectedAppIsListed() async throws {
        let harness = try await lockedHarness(isLockOn: false)
        harness.service.connectedApps = [
            ConnectedAppFixtures.projectScoped(identifier: "in-acme", projectIdentifier: "acme-launch"),
            ConnectedAppFixtures.projectScoped(identifier: "in-secret", projectIdentifier: "secret-garden")
        ]
        await harness.model.loadConnectedApps()
        #expect(harness.model.visibleConnectedApps.map(\.identifier).sorted() == ["in-acme", "in-secret"])
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
        #expect(harness.model.banner == .workspaceGone)
        harness.model.dismissBanner()
        await harness.model.deleteProject(projectIdentifier: "secret-garden")
        #expect(harness.model.banner == .workspaceGone)
        harness.model.dismissBanner()
        #expect(await harness.model.renameProject(projectIdentifier: "secret-garden", name: "Peek") == nil)
        #expect(harness.model.banner == .workspaceGone)
        #expect(harness.service.calls.isEmpty)
        #expect(harness.authenticator.asked.isEmpty)
    }

    @Test func aTaskChangeForALockedWorkspaceNeverReachesTheOutbox() async throws {
        let harness = try await lockedHarness()
        await harness.model.complete(task: secretKey)
        await harness.model.addTask(title: "Peek", projectIdentifier: "secret-inbox", dueDate: nil)
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func visibleWorkspacesIsTheCurrentOneAloneWhileLocked() async throws {
        let harness = try await lockedHarness()
        #expect(harness.model.visibleWorkspaces.map(\.identifier) == ["acme"])
    }

    @Test func visibleWorkspacesIsEveryWorkspaceWhenUnlockedOrWithTheLockOff() async throws {
        let unlocked = try await lockedHarness()
        _ = await unlocked.model.beginWorkspaceSwitch()
        #expect(unlocked.model.visibleWorkspaces.map(\.identifier) == ["acme", "secret"])
        let lockOff = try await lockedHarness(isLockOn: false)
        #expect(lockOff.model.visibleWorkspaces.map(\.identifier) == ["acme", "secret"])
    }

    @Test func visibleWorkspacesIsEmptyWhileLockedWhenTheCurrentOneIsMissing() async throws {
        let harness = try AppModelHarness(isWorkspaceLockOn: true)
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "secret")
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(harness.model.visibleWorkspaces.isEmpty)
    }

    @Test func switchingWorkspacesWhileLockedAsksEvenWhenTheCurrentOneIsTheOnlyWorkspace() async throws {
        let harness = try AppModelHarness(isWorkspaceLockOn: true)
        let acme = harness.seedWorkspace(name: "acme")
        harness.cache([acme], active: acme)
        await harness.signedIn()
        #expect(harness.model.visibleWorkspaces.map(\.identifier) == ["acme"])
        #expect(await harness.model.beginWorkspaceSwitch())
        #expect(harness.authenticator.asked == [.switchWorkspaces])
    }

    @Test func aCancelledSwitchPromptChangesNothing() async throws {
        let harness = try await lockedHarness()
        harness.authenticator.isOwnerAuthenticated = false
        harness.authenticator.isCancelling = true
        #expect(!(await harness.model.beginWorkspaceSwitch()))
        #expect(harness.model.workspaceLock.isLocked)
        #expect(harness.model.visibleWorkspaces.map(\.identifier) == ["acme"])
        #expect(!harness.model.workspaceLock.isConfirmationFailed)
    }

    @Test func aConfirmedSwitchPromptUnlocksTheSessionAndListsEveryWorkspace() async throws {
        let harness = try await lockedHarness()
        #expect(await harness.model.beginWorkspaceSwitch())
        #expect(harness.model.workspaceLock.isUnlocked)
        #expect(harness.model.visibleWorkspaces.map(\.identifier) == ["acme", "secret"])
    }

    @Test func switchingWorkspacesInAnUnlockedSessionOrWithTheLockOffAsksNothing() async throws {
        let unlocked = try await lockedHarness()
        _ = await unlocked.model.beginWorkspaceSwitch()
        #expect(await unlocked.model.beginWorkspaceSwitch())
        #expect(unlocked.authenticator.asked.count == 1)
        let lockOff = try await lockedHarness(isLockOn: false)
        #expect(await lockOff.model.beginWorkspaceSwitch())
        #expect(lockOff.authenticator.asked.isEmpty)
    }

    @Test func twoSwitchRequestsTogetherShareOnePrompt() async throws {
        let harness = try await lockedHarness()
        harness.authenticator.isHolding = true
        let first = Task { await harness.model.beginWorkspaceSwitch() }
        let second = Task { await harness.model.beginWorkspaceSwitch() }
        await Task.yield()
        await Task.yield()
        harness.authenticator.release()
        #expect(await first.value)
        #expect(await second.value)
        #expect(harness.authenticator.asked == [.switchWorkspaces])
    }

    @Test func aChordBeyondTheVisibleWorkspacesDoesNothingAndAsksNothing() async throws {
        let harness = try await lockedHarness()
        await harness.model.switchWorkspace(number: 2)
        await harness.model.switchWorkspace(action: .next)
        await harness.model.switchWorkspace(action: .previous)
        await harness.model.switchWorkspace(identifier: "secret")
        await harness.model.selectWorkspaces(.all)
        await harness.model.toggleWorkspace(identifier: "secret")
        #expect(harness.authenticator.asked.isEmpty)
        #expect(harness.model.activeWorkspace?.identifier == "acme")
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme"])
    }

    @Test func anIntentToCompleteATaskOfALockedWorkspaceAnswersAsAnUnknownTaskDoes() async throws {
        let harness = try await lockedHarness()
        let locked = await harness.model.completeFromShortcut(key: secretKey)
        let unknown = await harness.model.completeFromShortcut(key: TaskKey(projectIdentifier: "nowhere-inbox", number: 1))
        #expect(locked == unknown)
    }

    @Test func aRenameAndADeletionNamingALockedWorkspaceAnswerThatItIsNoLongerAvailable() async throws {
        let harness = try await lockedHarness()
        #expect(await harness.model.renameWorkspace(identifier: "secret", name: "Peek") == nil)
        #expect(harness.model.banner == .workspaceGone)
        harness.model.dismissBanner()
        await harness.model.deleteProject(projectIdentifier: "secret-garden")
        #expect(harness.model.banner == .workspaceGone)
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
