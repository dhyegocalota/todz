import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let firstTask = TaskKey(projectIdentifier: inboxIdentifier, number: 1)
private let tomorrowOffset = 1

extension AppModelTests {
    @MainActor private func dayCloseHarness() async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        let today = harness.model.today
        harness.seedWorkspace(name: "acme")
        harness.service.tasksOfProject[inboxIdentifier] = [
            MutableTask(number: 1, title: "Send the invoice", dueDate: today, orderKey: "a0").record,
            MutableTask(number: 2, title: "Review the copy", dueDate: today, orderKey: "a1").record,
            MutableTask(number: 3, title: "Book the dentist", dueDate: today, state: .done, orderKey: "a2", completedAt: fixedInstant).record,
        ]
        await harness.signedIn()
        return harness
    }

    @Test func doneInTheDayCloseCompletesTheTaskWithOneWrite() async throws {
        let harness = try await dayCloseHarness()
        await harness.model.complete(task: firstTask)
        await harness.flushed()
        #expect(harness.service.calls == [.completeTasks(session: harness.session, projectIdentifier: inboxIdentifier, numbers: [1])])
        #expect(harness.model.todayHeadingCount == 1)
    }

    @Test func tomorrowInTheDayCloseMovesTheTaskToTomorrowWithOneWrite() async throws {
        let harness = try await dayCloseHarness()
        let tomorrow = harness.model.today.adding(days: tomorrowOffset)
        await harness.model.updateDueDate(task: firstTask, dueDate: tomorrow)
        await harness.flushed()
        #expect(harness.service.calls == [.updateTask(session: harness.session, projectIdentifier: inboxIdentifier, number: 1, patch: .dueDate(tomorrow))])
        #expect(harness.model.taskViews?.upcoming.map(\.task.title) == ["Send the invoice"])
        #expect(harness.model.todayHeadingCount == 1)
    }

    @Test func dropInTheDayCloseClearsTheDueDateAndKeepsTheTaskOpen() async throws {
        let harness = try await dayCloseHarness()
        await harness.model.updateDueDate(task: firstTask, dueDate: nil)
        await harness.flushed()
        #expect(harness.service.calls == [.updateTask(session: harness.session, projectIdentifier: inboxIdentifier, number: 1, patch: .dueDate(nil))])
        let dropped = harness.model.taskViews?.inbox.first { $0.task.number == 1 }
        #expect(dropped?.task.state == .open)
        #expect(dropped?.task.dueDate == nil)
        #expect(harness.model.todayHeadingCount == 1)
    }
}
