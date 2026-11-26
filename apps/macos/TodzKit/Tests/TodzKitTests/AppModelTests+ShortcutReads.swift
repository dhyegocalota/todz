import Testing
@testable import TodzKit

private let rowLimit = 5
private let taskLimit = 10

private func spokenToday(openCount: Int) -> ShortcutToday {
    let tasks = (0..<openCount).map {
        ShortcutTask(key: TaskKey(projectIdentifier: shortcutInboxIdentifier, number: $0 + 1), title: "Task \($0 + 1)", projectName: "Inbox")
    }
    let content = MorningGlanceContent(workspaceIdentifier: "acme", openCount: openCount, rows: [], restCount: openCount)
    return ShortcutToday(workspaceName: "acme", content: content, tasks: tasks, isOffline: false)
}

extension AppModelTests {
    @Test func theShortcutTodayIsNoneWhileTodayLoads() throws {
        let harness = try AppModelHarness()
        #expect(harness.model.shortcutToday == nil)
    }

    @Test func theShortcutTodayIsNoneWhileSignedOut() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        #expect(harness.model.shortcutToday == nil)
    }

    @Test func anEmptyTodayAnswersNothingOpenWithNoRowsAndNoTasks() async throws {
        let harness = try await todayHarness(openCount: 0)
        let today = try #require(harness.model.shortcutToday)
        #expect(today.content.openCount == 0)
        #expect(today.content.rows.isEmpty)
        #expect(today.tasks.isEmpty)
    }

    @Test func oneOpenTaskIsOneRowAndOneTask() async throws {
        let harness = try await todayHarness(openCount: 1)
        let today = try #require(harness.model.shortcutToday)
        #expect(today.content.openCount == 1)
        #expect(today.content.rows.map(\.title) == ["Task 1"])
        #expect(today.tasks == [ShortcutTask(key: TaskKey(projectIdentifier: shortcutInboxIdentifier, number: 1), title: "Task 1", projectName: "Inbox")])
    }

    @Test func fiveOpenTasksAreFiveRowsAndFiveTasks() async throws {
        let harness = try await todayHarness(openCount: rowLimit)
        let today = try #require(harness.model.shortcutToday)
        #expect(today.content.rows.count == rowLimit)
        #expect(today.content.restCount == 0)
        #expect(today.tasks.count == rowLimit)
    }

    @Test func sevenOpenTasksAreFiveRowsTwoMoreAndSevenTasksInTodaysOrder() async throws {
        let harness = try await todayHarness(openCount: 7)
        let today = try #require(harness.model.shortcutToday)
        #expect(today.content.rows.map(\.title) == (1...rowLimit).map { "Task \($0)" })
        #expect(today.content.restCount == 2)
        #expect(today.tasks.map(\.title) == (1...7).map { "Task \($0)" })
    }

    @Test func anOverdueTaskStaysOnItsRowMarkedOverdue() async throws {
        let harness = try await todayHarness(openCount: 1, dueDaysFromToday: -1)
        let today = try #require(harness.model.shortcutToday)
        #expect(today.content.rows.map(\.isOverdue) == [true])
        #expect(today.tasks.map(\.title) == ["Task 1"])
    }

    @Test func aPendingTaskIsNeitherCountedNorListedInTheShortcutToday() async throws {
        let harness = try await todayHarness(openCount: 2)
        harness.service.suspend(.addTasks)
        await harness.model.addTask(title: "Call the bank", projectIdentifier: shortcutInboxIdentifier, dueDate: harness.model.today)
        await harness.service.held(.addTasks)
        let today = try #require(harness.model.shortcutToday)
        #expect(today.content.openCount == 2)
        #expect(today.content.openCount == harness.model.todayHeadingCount)
        #expect(today.tasks.map(\.title) == ["Task 1", "Task 2"])
        harness.service.resume(.addTasks)
        await harness.flushed()
    }

    @Test func theShortcutTodayNamesTheActiveWorkspace() async throws {
        let harness = try await todayHarness(openCount: 1)
        #expect(harness.model.shortcutToday?.workspaceName == "acme")
    }

    @Test func theShortcutTodayIsOnlineAfterAnAnsweredPull() async throws {
        let harness = try await todayHarness(openCount: 1)
        #expect(harness.model.shortcutToday?.isOffline == false)
    }

    @Test func theShortcutTodayIsOfflineAfterAnUnreachablePullWithACache() async throws {
        let harness = try await todayHarness(openCount: 1)
        harness.service.failures[.readChanges] = .unreachable
        await harness.model.refresh()
        let today = try #require(harness.model.shortcutToday)
        #expect(today.isOffline)
        #expect(today.tasks.map(\.title) == ["Task 1"])
    }

    @Test func nothingOpenIsTheNothingLeftSentenceWithNoTitles() {
        let today = spokenToday(openCount: 0)
        #expect(today.sentence == .nothingLeft)
        #expect(today.spokenTitles.isEmpty)
    }

    @Test func oneOpenTaskIsSpokenWithItsTitle() {
        let today = spokenToday(openCount: 1)
        #expect(today.sentence == .withTitles)
        #expect(today.spokenTitles == ["Task 1"])
    }

    @Test func threeOpenTasksAreSpokenWithEveryTitle() {
        let today = spokenToday(openCount: 3)
        #expect(today.sentence == .withTitles)
        #expect(today.spokenTitles == ["Task 1", "Task 2", "Task 3"])
    }

    @Test func fourOpenTasksAreSpokenWithTheFirstThreeTitles() {
        let today = spokenToday(openCount: 4)
        #expect(today.sentence == .withFirstTitles)
        #expect(today.spokenTitles == ["Task 1", "Task 2", "Task 3"])
    }

    @Test func sevenOpenTasksAreSpokenWithTheFirstThreeInTodaysOrder() {
        let today = spokenToday(openCount: 7)
        #expect(today.sentence == .withFirstTitles)
        #expect(today.spokenTitles == ["Task 1", "Task 2", "Task 3"])
    }

    @Test func theSuggestionsAreTodaysOpenTasksInTodaysOrderAtMostTen() async throws {
        let harness = try await todayHarness(openCount: 11)
        #expect(harness.model.shortcutSuggestedTasks.map(\.title) == (1...taskLimit).map { "Task \($0)" })
    }

    @Test func aTaskDoneTodayIsNeverSuggested() async throws {
        let harness = try await shortcutHarness { today in
            [
                MutableTask(number: 1, title: "Done today", dueDate: today, state: .done, completedAt: fixedInstant),
                MutableTask(number: 2, title: "Still open", dueDate: today),
            ]
        }
        #expect(harness.model.shortcutSuggestedTasks.map(\.title) == ["Still open"])
    }

    @Test func anUndatedInboxTaskIsNotSuggested() async throws {
        let harness = try await shortcutHarness { today in
            [MutableTask(number: 1, title: "Someday"), MutableTask(number: 2, title: "Today", dueDate: today)]
        }
        #expect(harness.model.shortcutSuggestedTasks.map(\.title) == ["Today"])
    }

    @Test func matchingIgnoresCase() async throws {
        let harness = try await shortcutHarness { today in
            [MutableTask(number: 1, title: "Review PR", dueDate: today), MutableTask(number: 2, title: "Code review", dueDate: today), MutableTask(number: 3, title: "Lunch", dueDate: today)]
        }
        #expect(harness.model.shortcutTasks(matching: "review").map(\.title) == ["Review PR", "Code review"])
    }

    @Test func matchingIgnoresDiacritics() async throws {
        let harness = try await shortcutHarness { _ in [MutableTask(number: 1, title: "Revisão do contrato")] }
        #expect(harness.model.shortcutTasks(matching: "revisao").map(\.title) == ["Revisão do contrato"])
    }

    @Test func matchingFindsATitleThatStartsWithAnEmoji() async throws {
        let harness = try await shortcutHarness { _ in [MutableTask(number: 1, title: "🚀 Ship it")] }
        #expect(harness.model.shortcutTasks(matching: "ship").map(\.title) == ["🚀 Ship it"])
    }

    @Test func aTodayMatchComesBeforeAnUndatedOne() async throws {
        let harness = try await shortcutHarness { today in
            [MutableTask(number: 1, title: "Draft the plan"), MutableTask(number: 2, title: "Plan the trip", dueDate: today)]
        }
        #expect(harness.model.shortcutTasks(matching: "plan").map(\.title) == ["Plan the trip", "Draft the plan"])
    }

    @Test func anUpcomingMatchComesAfterTodaysOne() async throws {
        let harness = try await shortcutHarness { today in
            [MutableTask(number: 1, title: "Call Bob", dueDate: today.adding(days: 1)), MutableTask(number: 2, title: "Call Ana", dueDate: today)]
        }
        #expect(harness.model.shortcutTasks(matching: "call").map(\.title) == ["Call Ana", "Call Bob"])
    }

    @Test func twelveMatchesAreTen() async throws {
        let harness = try await todayHarness(openCount: 12)
        #expect(harness.model.shortcutTasks(matching: "task").map(\.title) == (1...taskLimit).map { "Task \($0)" })
    }

    @Test(arguments: ["", "   "])
    func aBlankTextMatchesNothing(text: String) async throws {
        let harness = try await todayHarness(openCount: 2)
        #expect(harness.model.shortcutTasks(matching: text).isEmpty)
    }

    @Test func aDoneTaskNeverMatches() async throws {
        let harness = try await shortcutHarness { today in
            [MutableTask(number: 1, title: "Pay rent", dueDate: today, state: .done, completedAt: fixedInstant)]
        }
        #expect(harness.model.shortcutTasks(matching: "rent").isEmpty)
    }

    @Test func aTaskOfAnotherWorkspaceNeverMatches() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "side")
        harness.service.tasksOfProject["side-inbox"] = [MutableTask(number: 1, title: "Water the garden").record]
        harness.rememberWorkspace(identifier: "acme")
        await harness.signedIn()
        #expect(harness.model.activeWorkspace?.identifier == "acme")
        #expect(harness.model.shortcutTasks(matching: "garden").isEmpty)
    }

    @Test func aPendingAddNeverMatches() async throws {
        let harness = try await todayHarness(openCount: 1)
        harness.service.suspend(.addTasks)
        await harness.model.addTask(title: "Call the bank", projectIdentifier: shortcutInboxIdentifier, dueDate: harness.model.today)
        await harness.service.held(.addTasks)
        #expect(harness.model.shortcutTasks(matching: "bank").isEmpty)
        harness.service.resume(.addTasks)
        await harness.flushed()
    }

    @Test func keysResolveOpenAndDoneTasksOfTheActiveWorkspaceInTheOrderAsked() async throws {
        let harness = try await shortcutHarness { today in
            [MutableTask(number: 1, title: "Open one", dueDate: today), MutableTask(number: 2, title: "Done one", state: .done, completedAt: fixedInstant)]
        }
        let open = TaskKey(projectIdentifier: shortcutInboxIdentifier, number: 1)
        let done = TaskKey(projectIdentifier: shortcutInboxIdentifier, number: 2)
        #expect(harness.model.shortcutTasks(for: [done, open]).map(\.title) == ["Done one", "Open one"])
    }

    @Test func anUnknownKeyAndAKeyOfAnotherWorkspaceAreDropped() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "side")
        harness.service.tasksOfProject[shortcutInboxIdentifier] = [MutableTask(number: 1, title: "Open one").record]
        harness.service.tasksOfProject["side-inbox"] = [MutableTask(number: 1, title: "Water the garden").record]
        harness.rememberWorkspace(identifier: "acme")
        await harness.signedIn()
        let keys = [
            TaskKey(projectIdentifier: shortcutInboxIdentifier, number: 99),
            TaskKey(projectIdentifier: "side-inbox", number: 1),
            TaskKey(projectIdentifier: shortcutInboxIdentifier, number: 1),
        ]
        #expect(harness.model.shortcutTasks(for: keys).map(\.title) == ["Open one"])
    }

    @Test func keysResolveNothingWhileSignedOut() async throws {
        let harness = try await todayHarness(openCount: 1)
        await harness.model.signOut()
        #expect(harness.model.shortcutTasks(for: [TaskKey(projectIdentifier: shortcutInboxIdentifier, number: 1)]).isEmpty)
    }
}
