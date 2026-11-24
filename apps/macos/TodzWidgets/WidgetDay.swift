import Foundation
import TodzKit

struct WidgetDay {
    let day: CalendarDate
    let timeZone: TimeZone

    func dueText(of task: WidgetSnapshotTask) -> String? {
        guard let dueDate = task.dueDate else { return nil }
        guard task.isOverdue else { return WidgetCopy.dueToday }
        return TaskRowCopy.overdue(date: DayFormat.short(day: dueDate, today: day, timeZone: timeZone))
    }
}
