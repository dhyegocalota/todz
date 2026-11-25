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

    @MainActor func cachedHarness(cachedTitle: String, pulledTitle: String) throws -> AppModelHarness {
        let harness = try AppModelHarness()
        let workspace = harness.seedWorkspace(name: "acme")
        let today = harness.model.today
        harness.cache([workspace], active: workspace)
        harness.store.projects[shortcutInboxIdentifier] = ProjectCache(
            projectIdentifier: shortcutInboxIdentifier,
            cursor: 0,
            tasks: [MutableTask(number: 1, title: cachedTitle, dueDate: today).record]
        )
        harness.service.tasksOfProject[shortcutInboxIdentifier] = [MutableTask(number: 1, title: pulledTitle, dueDate: today).record]
        harness.vault.secret = harness.session
        return harness
    }
}
