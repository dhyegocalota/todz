import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let orderIdentifier = "acme-order"

extension AppModelTests {
    @MainActor private func harnessWithTodayTasks() throws -> AppModelHarness {
        let harness = try AppModelHarness()
        let today = harness.model.today
        harness.seedWorkspace(name: "acme", projectNames: ["order"])
        harness.service.tasksOfProject[inboxIdentifier] = [
            MutableTask(number: 1, title: "Due today", dueDate: today).record,
            MutableTask(number: 2, title: "Done today", dueDate: today, state: .done, completedAt: fixedInstant).record,
        ]
        harness.service.tasksOfProject[orderIdentifier] = [MutableTask(number: 1, title: "Also due", dueDate: today).record]
        return harness
    }

    @Test func theHeadingCountIsTodaysOpenTasksOnceEveryProjectLoaded() async throws {
        let harness = try harnessWithTodayTasks()
        await harness.signedIn()
        #expect(harness.model.todayHeadingCount == 2)
    }

    @Test func theHeadingCountStaysWhenOneProjectFailedToLoad() async throws {
        let harness = try harnessWithTodayTasks()
        harness.service.projectFailures[orderIdentifier] = .unreachable
        await harness.signedIn()
        #expect(harness.model.projectLoads == ["acme-inbox": .loaded, orderIdentifier: .unreachable])
        #expect(harness.model.todayHeadingCount == 1)
    }

    @Test func theHeadingCountIsNoneWhenNoProjectLoaded() async throws {
        let harness = try harnessWithTodayTasks()
        harness.service.projectFailures[inboxIdentifier] = .unreachable
        harness.service.projectFailures[orderIdentifier] = .unreachable
        await harness.signedIn()
        #expect(harness.model.todayHeadingCount == nil)
    }

    @Test func theHeadingCountIsNoneBeforeAnyWorkspaceLoaded() throws {
        let harness = try harnessWithTodayTasks()
        #expect(harness.model.todayHeadingCount == nil)
    }
}
