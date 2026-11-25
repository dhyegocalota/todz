import Testing
@testable import TodzKit

extension AppModelTests {
    @Test func aTextThatMatchesOneOpenTaskResolvesToIt() async throws {
        let harness = try await shortcutHarness { today in
            [MutableTask(number: 1, title: "Review PR", dueDate: today), MutableTask(number: 2, title: "Lunch", dueDate: today)]
        }
        let resolution = harness.model.shortcutResolution(matching: "review")
        #expect(resolution == .one(try #require(harness.model.shortcutTasks(matching: "review").first)))
    }

    @Test func aTextThatMatchesTwoOpenTasksResolvesToBothInOrder() async throws {
        let harness = try await shortcutHarness { today in
            [MutableTask(number: 1, title: "Review PR", dueDate: today), MutableTask(number: 2, title: "Code review notes", dueDate: today)]
        }
        let resolution = harness.model.shortcutResolution(matching: "review")
        #expect(resolution == .many(harness.model.shortcutTasks(matching: "review")))
        guard case let .many(tasks) = resolution else { Issue.record("expected many"); return }
        #expect(tasks.map(\.title) == ["Review PR", "Code review notes"])
    }

    @Test func aTextThatMatchesNothingResolvesToNone() async throws {
        let harness = try await shortcutHarness { today in [MutableTask(number: 1, title: "Review PR", dueDate: today)] }
        #expect(harness.model.shortcutResolution(matching: "zzz") == ShortcutResolution.none)
    }

    @Test func aBlankTextResolvesToNoneEvenWithTasksOpen() async throws {
        let harness = try await todayHarness(openCount: 3)
        #expect(harness.model.shortcutResolution(matching: "   ") == ShortcutResolution.none)
    }

    @Test func aDoneTaskNeverResolves() async throws {
        let harness = try await shortcutHarness { _ in [MutableTask(number: 1, title: "Book the dentist", state: .done)] }
        #expect(harness.model.shortcutResolution(matching: "dentist") == ShortcutResolution.none)
    }

    @Test func aTextThatMatchesAnOpenTaskOnlyOutsideTodayResolvesToIt() async throws {
        let harness = try await shortcutHarness { _ in [MutableTask(number: 1, title: "Buy milk")] }
        guard case let .one(task) = harness.model.shortcutResolution(matching: "milk") else { Issue.record("expected one"); return }
        #expect(task.title == "Buy milk")
    }

    @Test func manyIsCappedAtTheTaskLimit() async throws {
        let harness = try await todayHarness(openCount: ShortcutLimits.taskLimit + 2)
        guard case let .many(tasks) = harness.model.shortcutResolution(matching: "task") else { Issue.record("expected many"); return }
        #expect(tasks.count == ShortcutLimits.taskLimit)
    }
}
