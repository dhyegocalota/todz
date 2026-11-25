import Foundation
import Testing
@testable import TodzKit

private let inbox = Project(identifier: "inbox", name: "Inbox", isInbox: true, createdAt: fixedInstant)
private let today = CalendarDate(year: 2026, month: 11, day: 24)
private let doneTaskCount = 3_000
private let secondsPerDay: TimeInterval = 86_400
private let dueDaySpan = 5

private func views(of tasks: [TaskRecord]) throws -> TaskViews {
    let timeZone = try #require(TimeZone(identifier: "America/Sao_Paulo"))
    var board = TaskBoard()
    board.merge(projectIdentifier: inbox.identifier, tasks: tasks)
    return TaskViews(projects: [inbox], board: board, day: today, timeZone: timeZone)
}

@Suite struct TaskViewsGroupingTests {
    @Test func theDoneDaysGroupEveryTaskUnderItsDayNewestFirst() throws {
        let completed = (1...doneTaskCount).map { number in
            let instant = fixedInstant.addingTimeInterval(-secondsPerDay * Double(number % 2) - Double(number))
            return MutableTask(number: number, state: .done, completedAt: instant).record
        }
        let days = try views(of: completed).doneDays
        #expect(days.count == 2)
        #expect(days.map(\.tasks.count).reduce(0, +) == doneTaskCount)
        #expect(days.allSatisfy { $0.tasks.map(\.task.completedAt) == $0.tasks.map(\.task.completedAt).sorted { $0! > $1! } })
        #expect(days[0].day > days[1].day)
    }

    @Test func theUpcomingDaysGroupEveryTaskUnderItsDueDateInOrder() throws {
        let dated = (1...doneTaskCount).map { number in
            MutableTask(number: number, dueDate: today.adding(days: 1 + number % dueDaySpan), orderKey: "a\(String(format: "%05d", number))").record
        }
        let days = try views(of: dated).upcomingDays
        #expect(days.count == dueDaySpan)
        #expect(days.map(\.day) == days.map(\.day).sorted())
        #expect(days.map(\.tasks.count).reduce(0, +) == doneTaskCount)
        #expect(days.allSatisfy { $0.tasks.map(\.task.orderKey) == $0.tasks.map(\.task.orderKey).sorted() })
    }
}
