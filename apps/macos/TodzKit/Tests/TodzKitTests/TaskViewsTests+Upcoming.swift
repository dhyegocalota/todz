import Foundation
import Testing
@testable import TodzKit

private let inbox = Project(identifier: "inbox", name: "Inbox", isInbox: true, createdAt: fixedInstant)
private let alpha = Project(identifier: "alpha", name: "Alpha", isInbox: false, createdAt: fixedInstant)
private let today = CalendarDate(year: 2026, month: 11, day: 24)
private let tomorrow = CalendarDate(year: 2026, month: 11, day: 25)
private let dayAfterTomorrow = CalendarDate(year: 2026, month: 11, day: 26)
private let nextWeek = CalendarDate(year: 2026, month: 12, day: 1)

private func open(_ number: Int, dueDate: CalendarDate?) -> TaskRecord {
    MutableTask(number: number, dueDate: dueDate).record
}

private func pending(_ title: String, dueDate: CalendarDate?) -> PendingTask {
    PendingTask(projectIdentifier: inbox.identifier, idempotencyKey: "key-\(title)", title: title, dueDate: dueDate)
}

private func views(inboxTasks: [TaskRecord], alphaTasks: [TaskRecord] = [], pendingTasks: [PendingTask] = []) throws -> TaskViews {
    let timeZone = try #require(TimeZone(identifier: "America/Sao_Paulo"))
    var board = TaskBoard()
    board.merge(projectIdentifier: inbox.identifier, tasks: inboxTasks)
    board.merge(projectIdentifier: alpha.identifier, tasks: alphaTasks)
    return TaskViews(projects: [inbox, alpha], board: board, pendingTasks: pendingTasks, day: today, timeZone: timeZone)
}

private func shape(_ schedule: [UpcomingDay]) -> [String] {
    schedule.map { upcomingDay in
        let numbers = upcomingDay.tasks.map { "\($0.project.identifier) \($0.task.number)" }
        let titles = upcomingDay.pendingTasks.map(\.title)
        return "\(upcomingDay.day.text): \(numbers + titles)"
    }
}

@Suite struct TaskViewsUpcomingTests {
    @Test func noTaskDueLaterMakesNoUpcomingDay() throws {
        let views = try views(inboxTasks: [open(1, dueDate: today), open(2, dueDate: nil)])
        #expect(views.upcomingSchedule == [])
    }

    @Test func withNoPendingAddTheScheduleIsTheUpcomingDays() throws {
        let views = try views(inboxTasks: [open(1, dueDate: nextWeek), open(2, dueDate: tomorrow)], alphaTasks: [open(1, dueDate: tomorrow)])
        let expected = views.upcomingDays.map { UpcomingDay(day: $0.day, tasks: $0.tasks, pendingTasks: []) }
        #expect(views.upcomingSchedule == expected)
        #expect(shape(views.upcomingSchedule) == ["2026-11-25: [\"inbox 2\", \"alpha 1\"]", "2026-12-01: [\"inbox 1\"]"])
    }

    @Test func aPendingAddJoinsTheConfirmedTasksOfItsDayAfterThem() throws {
        let views = try views(
            inboxTasks: [open(1, dueDate: tomorrow)],
            pendingTasks: [pending("Second", dueDate: tomorrow), pending("Third", dueDate: tomorrow)]
        )
        #expect(shape(views.upcomingSchedule) == ["2026-11-25: [\"inbox 1\", \"Second\", \"Third\"]"])
    }

    @Test func aDayWithOnlyPendingAddsTakesItsPlaceInDateOrder() throws {
        let views = try views(
            inboxTasks: [open(1, dueDate: tomorrow), open(2, dueDate: nextWeek)],
            pendingTasks: [pending("Later", dueDate: dayAfterTomorrow)]
        )
        #expect(shape(views.upcomingSchedule) == [
            "2026-11-25: [\"inbox 1\"]",
            "2026-11-26: [\"Later\"]",
            "2026-12-01: [\"inbox 2\"]",
        ])
    }

    @Test func pendingAddsDueTodayOrUndatedStayOutOfTheSchedule() throws {
        let views = try views(inboxTasks: [], pendingTasks: [pending("Today", dueDate: today), pending("Undated", dueDate: nil)])
        #expect(views.upcomingSchedule == [])
    }
}
