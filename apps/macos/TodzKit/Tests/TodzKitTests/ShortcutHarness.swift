import Testing
@testable import TodzKit

let shortcutInboxIdentifier = "acme-inbox"

extension AppModelTests {
    @MainActor func shortcutHarness(inboxTasks: (CalendarDate) -> [MutableTask]) async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.service.tasksOfProject[shortcutInboxIdentifier] = inboxTasks(harness.model.today).map(\.record)
        await harness.signedIn()
        return harness
    }

    @MainActor func todayHarness(openCount: Int, dueDaysFromToday: Int = 0) async throws -> AppModelHarness {
        try await shortcutHarness { today in
            (0..<openCount).map { MutableTask(number: $0 + 1, title: "Task \($0 + 1)", dueDate: today.adding(days: dueDaysFromToday)) }
        }
    }
}
