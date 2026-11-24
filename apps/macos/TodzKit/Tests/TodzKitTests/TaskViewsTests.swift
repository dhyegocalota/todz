import Foundation
import Testing
@testable import TodzKit

private let inbox = Project(identifier: "inbox", name: "Inbox", isInbox: true, createdAt: fixedInstant)
private let alpha = Project(identifier: "alpha", name: "Alpha", isInbox: false, createdAt: fixedInstant)
private let beta = Project(identifier: "beta", name: "Beta", isInbox: false, createdAt: fixedInstant)
private let sidebar = [inbox, alpha, beta]
private let today = CalendarDate(year: 2026, month: 11, day: 24)
private let yesterday = CalendarDate(year: 2026, month: 11, day: 23)
private let tomorrow = CalendarDate(year: 2026, month: 11, day: 25)
private let nextWeek = CalendarDate(year: 2026, month: 12, day: 1)
private let lastSecondOfYesterday = Date(timeIntervalSince1970: 1_795_489_199)
private let firstSecondOfToday = Date(timeIntervalSince1970: 1_795_489_200)

private func open(_ number: Int, dueDate: CalendarDate? = nil, orderKey: String = "a0") -> TaskRecord {
    MutableTask(number: number, dueDate: dueDate, orderKey: orderKey).record
}

private func done(_ number: Int, completedAt: Date, dueDate: CalendarDate? = nil) -> TaskRecord {
    MutableTask(number: number, dueDate: dueDate, state: .done, completedAt: completedAt).record
}

private func views(_ tasksOfProject: [(Project, [TaskRecord])]) throws -> TaskViews {
    let timeZone = try #require(TimeZone(identifier: "America/Sao_Paulo"))
    let board = tasksOfProject.reduce(into: TaskBoard()) { board, entry in
        board.merge(projectIdentifier: entry.0.identifier, tasks: entry.1)
    }
    return TaskViews(projects: sidebar, board: board, day: today, timeZone: timeZone)
}

private func labels(_ tasks: [BoardTask]) -> [String] {
    tasks.map { "\($0.project.identifier) \($0.task.number)" }
}

@Suite struct TaskViewsTests {
    @Test func anEmptyBoardShowsEveryViewEmpty() throws {
        let views = try views([])
        #expect(views.inbox == [])
        #expect(views.project(identifier: alpha.identifier) == [])
        #expect(views.today == TodayTasks(open: [], doneToday: []))
        #expect(views.upcoming == [])
        #expect(views.done == [])
    }

    @Test func oneUndatedOpenTaskIsOnlyInItsProject() throws {
        let views = try views([(inbox, [open(1)])])
        #expect(labels(views.inbox) == ["inbox 1"])
        #expect(labels(views.project(identifier: inbox.identifier)) == ["inbox 1"])
        #expect(views.today.open == [])
        #expect(views.upcoming == [])
        #expect(views.done == [])
    }

    @Test func inboxAndProjectListOpenTasksByOrderKeyInByteOrder() throws {
        let views = try views([
            (inbox, [open(1, orderKey: "a1"), open(2, orderKey: "Zz"), open(3, orderKey: "a0"), done(4, completedAt: firstSecondOfToday)]),
            (alpha, [open(1, orderKey: "b"), open(2, orderKey: "a0V")]),
        ])
        #expect(labels(views.inbox) == ["inbox 2", "inbox 3", "inbox 1"])
        #expect(labels(views.project(identifier: alpha.identifier)) == ["alpha 2", "alpha 1"])
    }

    @Test func todayListsOverdueFirstThenTiesBySidebarThenOrderKeyThenNumber() throws {
        let views = try views([
            (inbox, [open(1, dueDate: today, orderKey: "a1"), open(2, dueDate: today, orderKey: "a0"), open(3, dueDate: today, orderKey: "a0")]),
            (alpha, [open(1, dueDate: today), open(2, dueDate: yesterday, orderKey: "z")]),
            (beta, [open(1, dueDate: yesterday), open(2, dueDate: today)]),
        ])
        #expect(labels(views.today.open) == ["alpha 2", "beta 1", "inbox 2", "inbox 3", "inbox 1", "alpha 1", "beta 2"])
    }

    @Test func aTaskDueYesterdayIsInTodayAndOneDueTomorrowIsUpcoming() throws {
        let views = try views([(inbox, [open(1, dueDate: yesterday), open(2, dueDate: tomorrow), open(3)])])
        #expect(labels(views.today.open) == ["inbox 1"])
        #expect(labels(views.upcoming) == ["inbox 2"])
    }

    @Test func twoProjectsTasksWithTheSameDueDateAndOrderKeyComeOutInSidebarOrder() throws {
        let views = try views([(beta, [open(1, dueDate: today)]), (alpha, [open(1, dueDate: today)]), (inbox, [open(1, dueDate: today)])])
        #expect(labels(views.today.open) == ["inbox 1", "alpha 1", "beta 1"])
    }

    @Test func doneTodayListsTodaysCompletionsNewestFirstAndLeavesYesterdaysOut() throws {
        let views = try views([
            (inbox, [done(1, completedAt: firstSecondOfToday, dueDate: today), done(2, completedAt: lastSecondOfYesterday)]),
            (alpha, [done(1, completedAt: firstSecondOfToday.addingTimeInterval(3_600))]),
        ])
        #expect(views.today.open == [])
        #expect(labels(views.today.doneToday) == ["alpha 1", "inbox 1"])
    }

    @Test func upcomingListsFutureDueDatesEarliestFirstThenBySidebar() throws {
        let views = try views([
            (inbox, [open(1, dueDate: nextWeek), open(2, dueDate: today)]),
            (alpha, [open(1, dueDate: tomorrow, orderKey: "b"), open(2, dueDate: tomorrow, orderKey: "a")]),
            (beta, [open(1, dueDate: tomorrow), done(2, completedAt: firstSecondOfToday, dueDate: tomorrow)]),
        ])
        #expect(labels(views.upcoming) == ["alpha 2", "alpha 1", "beta 1", "inbox 1"])
    }

    @Test func doneListsNewestCompletionFirstThenSidebarThenNumber() throws {
        let views = try views([
            (inbox, [done(2, completedAt: lastSecondOfYesterday), done(1, completedAt: firstSecondOfToday), open(3)]),
            (alpha, [done(2, completedAt: firstSecondOfToday), done(1, completedAt: firstSecondOfToday)]),
            (beta, [done(1, completedAt: firstSecondOfToday.addingTimeInterval(60))]),
        ])
        #expect(labels(views.done) == ["beta 1", "inbox 1", "alpha 1", "alpha 2", "inbox 2"])
    }

    @Test func emptyViewsHaveNoDays() throws {
        let views = try views([])
        #expect(views.upcomingDays == [])
        #expect(views.doneDays == [])
    }

    @Test func upcomingDaysGroupTheUpcomingOrderByDueDate() throws {
        let views = try views([
            (inbox, [open(1, dueDate: nextWeek), open(2, dueDate: tomorrow)]),
            (alpha, [open(1, dueDate: tomorrow), open(2, dueDate: today)]),
        ])
        #expect(views.upcomingDays.map(\.day) == [tomorrow, nextWeek])
        #expect(views.upcomingDays.map { labels($0.tasks) } == [["inbox 2", "alpha 1"], ["inbox 1"]])
    }

    @Test func doneDaysGroupTheDoneOrderByCompletionDayInTheZone() throws {
        let views = try views([
            (inbox, [done(1, completedAt: firstSecondOfToday), done(2, completedAt: lastSecondOfYesterday)]),
            (alpha, [done(1, completedAt: firstSecondOfToday.addingTimeInterval(60))]),
        ])
        #expect(views.doneDays.map(\.day) == [today, yesterday])
        #expect(views.doneDays.map { labels($0.tasks) } == [["alpha 1", "inbox 1"], ["inbox 2"]])
    }
}
