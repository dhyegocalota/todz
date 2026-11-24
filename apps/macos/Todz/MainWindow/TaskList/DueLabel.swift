import SwiftUI
import TodzKit

private let tomorrowOffset = 1

struct DueLabel: View {
    let dueDate: CalendarDate
    @Environment(AppModel.self) private var model

    var body: some View {
        Text(Self.text(dueDate: dueDate, today: model.today, timeZone: model.timeZone))
            .foregroundStyle(isOverdue ? AnyShapeStyle(Color.red) : AnyShapeStyle(.foreground))
    }

    private var isOverdue: Bool {
        dueDate < model.today
    }

    static func text(dueDate: CalendarDate, today: CalendarDate, timeZone: TimeZone) -> String {
        guard dueDate != today else { return TaskRowCopy.dueToday }
        guard dueDate != today.adding(days: tomorrowOffset) else { return TaskRowCopy.dueTomorrow }
        let date = DayFormat.short(day: dueDate, today: today, timeZone: timeZone)
        guard dueDate < today else { return date }
        return TaskRowCopy.overdue(date: date)
    }
}
