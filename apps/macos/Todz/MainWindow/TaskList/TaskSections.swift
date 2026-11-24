import Foundation
import TodzKit

private let openSection = "open"
private let doneTodaySection = "done-today"
private let tomorrowOffset = 1
private let yesterdayOffset = -1

enum TaskSections {
    static func sections(item: SidebarItem, views: TaskViews, today: CalendarDate, timeZone: TimeZone) -> [TaskSection] {
        switch item {
        case .inbox:
            return [manualSection(tasks: views.inbox)]
        case let .project(identifier):
            return [manualSection(tasks: views.project(identifier: identifier))]
        case .today:
            return todaySections(views.today)
        case .upcoming:
            return views.upcomingDays.map { taskDay in
                daySection(taskDay: taskDay, title: upcomingTitle(day: taskDay.day, today: today, timeZone: timeZone))
            }
        case .done:
            return views.doneDays.map { taskDay in
                daySection(taskDay: taskDay, title: doneTitle(day: taskDay.day, today: today, timeZone: timeZone))
            }
        }
    }

    private static func manualSection(tasks: [BoardTask]) -> TaskSection {
        TaskSection(identifier: openSection, title: nil, count: nil, tasks: tasks, hasManualOrder: true)
    }

    private static func todaySections(_ today: TodayTasks) -> [TaskSection] {
        let open = TaskSection(identifier: openSection, title: nil, count: nil, tasks: today.open, hasManualOrder: false)
        guard !today.doneToday.isEmpty else { return [open] }
        let done = TaskSection(
            identifier: doneTodaySection,
            title: MainWindowCopy.doneToday,
            count: today.doneToday.count,
            tasks: today.doneToday,
            hasManualOrder: false
        )
        return [open, done]
    }

    private static func daySection(taskDay: TaskDay, title: String) -> TaskSection {
        TaskSection(identifier: taskDay.day.text, title: title, count: nil, tasks: taskDay.tasks, hasManualOrder: false)
    }

    private static func upcomingTitle(day: CalendarDate, today: CalendarDate, timeZone: TimeZone) -> String {
        guard day != today.adding(days: tomorrowOffset) else { return MainWindowCopy.tomorrow }
        return DayFormat.full(day: day, timeZone: timeZone)
    }

    private static func doneTitle(day: CalendarDate, today: CalendarDate, timeZone: TimeZone) -> String {
        guard day != today else { return MainWindowCopy.todayGroup }
        guard day != today.adding(days: yesterdayOffset) else { return MainWindowCopy.yesterday }
        return DayFormat.full(day: day, timeZone: timeZone)
    }
}
