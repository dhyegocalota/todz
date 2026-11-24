import Foundation
import TodzKit

private let openSection = "open"
private let doneTodaySection = "done-today"
private let tomorrowOffset = 1
private let yesterdayOffset = -1

enum TaskSections {
    static func sections(
        item: SidebarItem,
        views: TaskViews,
        lingering: LingeringTasks,
        today: CalendarDate,
        timeZone: TimeZone
    ) -> [TaskSection] {
        let pendingTasks = views.pendingTasks(for: item)
        switch item {
        case .inbox:
            return [manualSection(tasks: lingering.placed(into: views.inbox), pendingTasks: pendingTasks)]
        case let .project(identifier):
            return [manualSection(tasks: lingering.placed(into: views.project(identifier: identifier)), pendingTasks: pendingTasks)]
        case .today:
            return todaySections(views.today, lingering: lingering, pendingTasks: pendingTasks)
        case .upcoming:
            return upcomingSections(views: views, today: today, timeZone: timeZone)
        case .done:
            return views.doneDays.map { taskDay in
                let title = doneTitle(day: taskDay.day, today: today, timeZone: timeZone)
                return daySection(day: taskDay.day, tasks: taskDay.tasks, pendingTasks: [], title: title)
            }
        }
    }

    private static func manualSection(tasks: [BoardTask], pendingTasks: [PendingTask]) -> TaskSection {
        TaskSection(identifier: openSection, title: nil, count: nil, tasks: tasks, pendingTasks: pendingTasks, hasManualOrder: true)
    }

    private static func todaySections(_ today: TodayTasks, lingering: LingeringTasks, pendingTasks: [PendingTask]) -> [TaskSection] {
        let doneToday = today.doneToday.filter { !lingering.keys.contains($0.key) }
        let open = TaskSection(
            identifier: openSection,
            title: nil,
            count: nil,
            tasks: lingering.placed(into: today.open),
            pendingTasks: pendingTasks,
            hasManualOrder: false
        )
        guard !doneToday.isEmpty else { return [open] }
        let done = TaskSection(
            identifier: doneTodaySection,
            title: MainWindowCopy.doneToday,
            count: doneToday.count,
            tasks: doneToday,
            pendingTasks: [],
            hasManualOrder: false
        )
        return [open, done]
    }

    private static func upcomingSections(views: TaskViews, today: CalendarDate, timeZone: TimeZone) -> [TaskSection] {
        let days = Set(views.upcomingDays.map(\.day) + views.upcomingPendingDays.map(\.day)).sorted()
        return days.map { day in
            daySection(
                day: day,
                tasks: views.upcomingDays.filter { $0.day == day }.flatMap(\.tasks),
                pendingTasks: views.upcomingPendingDays.filter { $0.day == day }.flatMap(\.tasks),
                title: upcomingTitle(day: day, today: today, timeZone: timeZone)
            )
        }
    }

    private static func daySection(day: CalendarDate, tasks: [BoardTask], pendingTasks: [PendingTask], title: String) -> TaskSection {
        TaskSection(identifier: day.text, title: title, count: nil, tasks: tasks, pendingTasks: pendingTasks, hasManualOrder: false)
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
