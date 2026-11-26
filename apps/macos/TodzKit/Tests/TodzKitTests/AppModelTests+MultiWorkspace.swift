import Foundation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 24)

private func dueToday(_ count: Int, prefix: String) -> [TaskRecord] {
    (1...count).map { MutableTask(number: $0, title: "\(prefix) \($0)", dueDate: today).record }
}

private func stored(projectIdentifier: String, number: Int, state: TaskState, workspaceIdentifier: String?) -> StoredWidgetRequest {
    let request = WidgetRequest(projectIdentifier: projectIdentifier, number: number, state: state, at: fixedInstant, workspaceIdentifier: workspaceIdentifier)
    return StoredWidgetRequest(name: "\(UUID().uuidString).json", request: request)
}

extension AppModelTests {
    @MainActor private func twoWorkspaceHarness() async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        harness.seedWorkspace(name: "side", projectNames: ["garden"])
        harness.service.tasksOfProject["acme-inbox"] = dueToday(2, prefix: "Acme")
        harness.service.tasksOfProject["side-inbox"] = dueToday(1, prefix: "Side")
        harness.rememberWorkspace(identifier: "acme")
        await harness.signedIn()
        return harness
    }

    @Test func selectingAllShowsTheUnionOfTodayInWorkspaceOrderTaggedWithTheWorkspaceName() async throws {
        let harness = try await twoWorkspaceHarness()
        await harness.model.selectWorkspaces(.all)
        let rows = try #require(harness.model.taskViews?.today.open)
        #expect(rows.map(\.task.title) == ["Acme 1", "Acme 2", "Side 1"])
        #expect(rows.map(\.workspaceName) == ["acme", "acme", "side"])
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "side"])
    }

    @Test func selectingAllShowsBothInboxesInWorkspaceOrder() async throws {
        let harness = try await twoWorkspaceHarness()
        await harness.model.selectWorkspaces(.all)
        let inbox = try #require(harness.model.taskViews?.inbox)
        #expect(inbox.map(\.task.title) == ["Acme 1", "Acme 2", "Side 1"])
    }

    @Test func selectingAllShowsTheUpcomingOfEveryWorkspace() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "side")
        let tomorrow = CalendarDate(year: 2026, month: 11, day: 25)
        harness.service.tasksOfProject["acme-inbox"] = [MutableTask(number: 1, title: "Acme later", dueDate: tomorrow).record]
        harness.service.tasksOfProject["side-inbox"] = [MutableTask(number: 1, title: "Side later", dueDate: tomorrow).record]
        harness.rememberWorkspace(identifier: "acme")
        await harness.signedIn()
        await harness.model.selectWorkspaces(.all)
        #expect(harness.model.taskViews?.upcoming.map(\.task.title) == ["Acme later", "Side later"])
    }

    @Test func aSingleSelectionTagsNothing() async throws {
        let harness = try await twoWorkspaceHarness()
        let rows = try #require(harness.model.taskViews?.today.open)
        #expect(rows.map(\.workspaceName) == [nil, nil])
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme"])
    }

    @Test func selectingAllPullsAndWatchesEveryProjectOfEveryWorkspace() async throws {
        let harness = try await twoWorkspaceHarness()
        await harness.model.selectWorkspaces(.all)
        let pulled = harness.service.calls.compactMap { call -> String? in
            guard case let .readChanges(_, projectIdentifier, _) = call else { return nil }
            return projectIdentifier
        }
        #expect(Set(pulled).isSuperset(of: ["side-inbox", "side-garden"]))
        #expect(harness.signals.opens.contains(harness.watchKey("side-inbox")))
        #expect(harness.signals.opens.contains(harness.watchKey("acme-launch")))
    }

    @Test func theMenuBarCountIsTheUnionOfTodayAcrossTheSelection() async throws {
        let harness = try await twoWorkspaceHarness()
        #expect(harness.model.todayHeadingCount == 2)
        await harness.model.selectWorkspaces(.all)
        #expect(harness.model.todayHeadingCount == 3)
    }

    @Test func allIncludesAWorkspaceAddedLater() async throws {
        let harness = try await twoWorkspaceHarness()
        await harness.model.selectWorkspaces(.all)
        harness.seedWorkspace(name: "later")
        harness.service.tasksOfProject["later-inbox"] = dueToday(1, prefix: "Later")
        await harness.model.reloadWorkspacesQuietly()
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "side", "later"])
        #expect(harness.model.taskViews?.today.open.map(\.task.title) == ["Acme 1", "Acme 2", "Side 1", "Later 1"])
    }

    @Test func aChosenPairDoesNotTakeAWorkspaceAddedLater() async throws {
        let harness = try await twoWorkspaceHarness()
        await harness.model.selectWorkspaces(.chosen(["acme", "side"]))
        harness.seedWorkspace(name: "later")
        await harness.model.reloadWorkspacesQuietly()
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "side"])
    }

    @Test func togglingAWorkspaceAddsItToTheSelectionAndTheLastOneStays() async throws {
        let harness = try await twoWorkspaceHarness()
        await harness.model.toggleWorkspace(identifier: "side")
        #expect(harness.model.selection == .chosen(["acme", "side"]))
        await harness.model.toggleWorkspace(identifier: "acme")
        await harness.model.toggleWorkspace(identifier: "side")
        #expect(harness.model.selection == .chosen(["side"]))
    }

    @Test func switchingWorkspaceAfterAllSelectsExactlyOne() async throws {
        let harness = try await twoWorkspaceHarness()
        await harness.model.selectWorkspaces(.all)
        await harness.model.switchWorkspace(identifier: "side")
        #expect(harness.model.selection == .chosen(["side"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["side"])
        #expect(harness.model.activeWorkspace?.identifier == "side")
        #expect(harness.model.taskViews?.today.open.map(\.task.title) == ["Side 1"])
    }

    @Test func theSelectionIsKeptInTheCacheAndRestoredByTheNextLaunch() async throws {
        let first = try await twoWorkspaceHarness()
        await first.model.selectWorkspaces(.all)
        #expect(first.store.owner?.selection == .all)
        let second = try AppModelHarness()
        second.seedWorkspace(name: "acme", projectNames: ["launch"])
        second.seedWorkspace(name: "side", projectNames: ["garden"])
        let kept = try #require(first.store.owner)
        second.store.owner = OwnerCache(
            ownerIdentifier: second.ownerIdentifier,
            workspaces: kept.workspaces,
            activeWorkspaceIdentifier: kept.activeWorkspaceIdentifier,
            selection: kept.selection
        )
        await second.launchedFromCache()
        #expect(second.model.selection == .all)
        #expect(second.model.shownWorkspaces.map(\.identifier) == ["acme", "side"])
    }

    @Test func aSingleSelectionKeepsTheCacheShapeOfBefore() async throws {
        let harness = try await twoWorkspaceHarness()
        await harness.model.switchWorkspace(identifier: "side")
        let side = try #require(harness.service.workspaces.first { $0.identifier == "side" })
        #expect(harness.store.owner == OwnerCache(ownerIdentifier: harness.ownerIdentifier, workspaces: harness.service.workspaces, activeWorkspaceIdentifier: side.identifier))
    }

    @Test func theSnapshotCarriesTheWorkspaceOfEveryTask() async throws {
        let harness = try await twoWorkspaceHarness()
        await harness.model.selectWorkspaces(.all)
        await harness.published()
        let snapshot = try #require(harness.widgets.snapshot)
        #expect(snapshot.open.map(\.workspaceIdentifier) == ["acme", "acme", "side"])
        #expect(snapshot.open.map(\.workspaceName) == ["acme", "acme", "side"])
    }

    @Test func aTickCompletesTheTaskInItsOwnWorkspaceProject() async throws {
        let harness = try await twoWorkspaceHarness()
        await harness.model.selectWorkspaces(.all)
        harness.service.calls = []
        harness.widgets.storedRequests = [stored(projectIdentifier: "side-inbox", number: 1, state: .done, workspaceIdentifier: "side")]
        await harness.model.takeWidgetRequests()
        await harness.flushed()
        #expect(harness.service.calls.contains(.completeTasks(session: harness.session, projectIdentifier: "side-inbox", numbers: [1])))
        #expect(harness.service.calls.contains { $0.route == .completeTasks && $0 != .completeTasks(session: harness.session, projectIdentifier: "side-inbox", numbers: [1]) } == false)
    }

    @Test func aTickNamingAnotherWorkspaceThanTheTaskProjectBelongsToIsRefused() async throws {
        let harness = try await twoWorkspaceHarness()
        await harness.model.selectWorkspaces(.all)
        harness.widgets.storedRequests = [stored(projectIdentifier: "side-inbox", number: 1, state: .done, workspaceIdentifier: "acme")]
        await harness.model.takeWidgetRequests()
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.widgets.storedRequests == [])
    }

    @Test func aTickForATaskOfAWorkspaceNotShownIsRefused() async throws {
        let harness = try await twoWorkspaceHarness()
        harness.widgets.storedRequests = [stored(projectIdentifier: "side-inbox", number: 1, state: .done, workspaceIdentifier: "side")]
        await harness.model.takeWidgetRequests()
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func togglingAWorkspaceOnPullsOnlyItsProjectsAndOffPullsNothing() async throws {
        let harness = try await twoWorkspaceHarness()
        await harness.model.toggleWorkspace(identifier: "side")
        let pulled = harness.service.calls.compactMap { call -> String? in
            guard case let .readChanges(_, projectIdentifier, _) = call else { return nil }
            return projectIdentifier
        }
        #expect(Set(pulled) == ["side-inbox", "side-garden"])
        #expect(harness.model.board.tasks(projectIdentifier: "acme-inbox").count == 2)
        harness.service.calls = []
        await harness.model.toggleWorkspace(identifier: "side")
        #expect(harness.service.routes().contains(.readChanges) == false)
        #expect(harness.model.board.tasks(projectIdentifier: "side-inbox") == [])
        #expect(harness.model.board.tasks(projectIdentifier: "acme-inbox").count == 2)
    }

    @Test func selectingManyProjectsNeverHasMorePullsInFlightThanTheCap() async throws {
        let harness = try AppModelHarness()
        (1...4).forEach { number in harness.seedWorkspace(name: "w\(number)", projectNames: ["a", "b"]) }
        harness.rememberWorkspace(identifier: "w1")
        await harness.signedIn()
        harness.service.suspend(.readChanges)
        harness.service.calls = []
        let selecting = Task { await harness.model.selectWorkspaces(.all) }
        await harness.service.held(.readChanges, count: AppModel.pullConcurrencyLimit)
        await Task.yield()
        #expect(harness.service.routes().filter { $0 == .readChanges }.count == AppModel.pullConcurrencyLimit)
        harness.service.unsuspend(.readChanges)
        (1...AppModel.pullConcurrencyLimit).forEach { _ in harness.service.resume(.readChanges) }
        await selecting.value
        #expect(harness.service.routes().filter { $0 == .readChanges }.count == 9)
    }

    @Test func aPullOfAWorkspaceDeselectedWhileItWasInFlightIsDropped() async throws {
        let harness = try await twoWorkspaceHarness()
        harness.service.suspend(.readChanges)
        let selecting = Task { await harness.model.selectWorkspaces(.all) }
        await harness.service.held(.readChanges, count: 2)
        await harness.model.selectWorkspaces(.chosen(["acme"]))
        harness.service.unsuspend(.readChanges)
        (1...2).forEach { _ in harness.service.resume(.readChanges) }
        await selecting.value
        #expect(harness.model.board.tasks(projectIdentifier: "side-inbox") == [])
    }

    @Test func aRequestWithNoWorkspaceForATaskNotShownIsDropped() async throws {
        let harness = try await twoWorkspaceHarness()
        harness.widgets.storedRequests = [stored(projectIdentifier: "side-inbox", number: 1, state: .done, workspaceIdentifier: nil)]
        await harness.model.takeWidgetRequests()
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func creatingAWorkspaceWhileOnAllKeepsAll() async throws {
        let harness = try await twoWorkspaceHarness()
        await harness.model.selectWorkspaces(.all)
        let created = try #require(await harness.model.createWorkspace(name: "Fresh"))
        #expect(harness.model.selection == .all)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "side", created.identifier])
    }

    @Test func aSingleWorkspaceInboxNeverReadsEmptyWhileAnAddIsWaitingOrSaved() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.rememberWorkspace(identifier: "acme")
        await harness.signedIn()
        harness.service.suspend(.addTasks)
        await harness.model.addTask(title: "Acme task", projectIdentifier: "acme-inbox", dueDate: nil)
        let waiting = try #require(harness.model.taskViews)
        #expect(waiting.inbox.count + waiting.pendingTasks(for: .inbox).count == 1)
        harness.service.unsuspend(.addTasks)
        harness.service.resume(.addTasks)
        await harness.flushed()
        let saved = try #require(harness.model.taskViews)
        #expect(saved.inbox.map(\.task.title) == ["Acme task"])
        #expect(saved.pendingTasks(for: .inbox) == [])
    }

    @Test func aTickForAnUnknownTaskIsRefused() async throws {
        let harness = try await twoWorkspaceHarness()
        await harness.model.selectWorkspaces(.all)
        harness.widgets.storedRequests = [stored(projectIdentifier: "side-inbox", number: 99, state: .done, workspaceIdentifier: "side")]
        await harness.model.takeWidgetRequests()
        #expect(harness.model.waitingChangeCount == 0)
    }
}
