import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let today = CalendarDate(year: 2026, month: 11, day: 24)
private let tomorrow = CalendarDate(year: 2026, month: 11, day: 25)
private let dueTodayTask = TaskKey(projectIdentifier: inboxIdentifier, number: 1)
private let doneTodayTask = TaskKey(projectIdentifier: inboxIdentifier, number: 2)
private let dueTomorrowTask = TaskKey(projectIdentifier: inboxIdentifier, number: 3)

extension AppModelTests {
    @MainActor private func linkHarness() async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "side")
        harness.service.tasksOfProject[inboxIdentifier] = [
            MutableTask(number: 1, title: "Due today", dueDate: today).record,
            MutableTask(number: 2, title: "Done today", dueDate: today, state: .done, completedAt: fixedInstant).record,
            MutableTask(number: 3, title: "Due tomorrow", dueDate: tomorrow).record,
        ]
        await harness.signedIn()
        harness.model.selectedItem = .inbox
        harness.model.selectedTask = dueTomorrowTask
        return harness
    }

    @Test func theTodayLinkSelectsTodayWithNoTask() async throws {
        let harness = try await linkHarness()
        harness.model.follow(.today)
        #expect(harness.model.selectedItem == .today)
        #expect(harness.model.selectedTask == nil)
    }

    @Test func aLinkToATaskInTodayRevealsIt() async throws {
        let harness = try await linkHarness()
        harness.model.follow(.task(dueTodayTask))
        #expect(harness.model.selectedItem == .today)
        #expect(harness.model.selectedTask == dueTodayTask)
    }

    @Test func aLinkToATaskDoneTodayRevealsIt() async throws {
        let harness = try await linkHarness()
        harness.model.follow(.task(doneTodayTask))
        #expect(harness.model.selectedTask == doneTodayTask)
    }

    @Test func aLinkToATaskNotInTodayOpensTodayWithNoTask() async throws {
        let harness = try await linkHarness()
        harness.model.follow(.task(dueTomorrowTask))
        #expect(harness.model.selectedItem == .today)
        #expect(harness.model.selectedTask == nil)
    }

    @Test func aLinkToAnotherWorkspacesTaskOpensTodayWithNoTask() async throws {
        let harness = try await linkHarness()
        harness.model.follow(.task(TaskKey(projectIdentifier: "side-inbox", number: 1)))
        #expect(harness.model.selectedItem == .today)
        #expect(harness.model.selectedTask == nil)
    }

    @Test func aLinkWhileSignedOutOpensTodayWithNoTask() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        harness.model.follow(.task(dueTodayTask))
        #expect(harness.model.selectedItem == .today)
        #expect(harness.model.selectedTask == nil)
    }

    @Test func aLinkNeverWrites() async throws {
        let harness = try await linkHarness()
        harness.model.follow(.task(dueTodayTask))
        harness.model.follow(.today)
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.service.calls == [])
    }
}
