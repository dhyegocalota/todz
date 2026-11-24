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
        lingers: CompletionLingers,
        today: CalendarDate,
        timeZone: TimeZone
    ) -> [TaskSection] {
        let pendingTasks = views.pendingTasks(for: item)
        switch item {
        case .inbox:
            return [manualSection(tasks: lingers.placed(into: views.inbox, item: item, views: views), pendingTasks: pendingTasks)]
        case let .project(identifier):
            let tasks = lingers.placed(into: views.project(identifier: identifier), item: item, views: views)
            return [manualSection(tasks: tasks, pendingTasks: pendingTasks)]
        case .today:
            return todaySections(views: views, lingers: lingers, pendingTasks: pendingTasks)
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

    private static func todaySections(views: TaskViews, lingers: CompletionLingers, pendingTasks: [PendingTask]) -> [TaskSection] {
        let today = views.today
        let lingeringKeys = lingers.lingeringKeys(item: .today, views: views)
        let doneToday = today.doneToday.filter { !lingeringKeys.contains($0.key) }
        let open = TaskSection(
            identifier: openSection,
            title: nil,
            count: nil,
            tasks: lingers.placed(into: today.open, item: .today, views: views),
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
        views.upcomingSchedule.map { upcomingDay in
            let title = upcomingTitle(day: upcomingDay.day, today: today, timeZone: timeZone)
            return daySection(day: upcomingDay.day, tasks: upcomingDay.tasks, pendingTasks: upcomingDay.pendingTasks, title: title)
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
