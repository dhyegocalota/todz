private let noWashOpacity = 0.0
private let singleDayOpacity = 0.06
private let lateOpacity = 0.09
private let longOverdueOpacity = 0.12
private let singleDayFromDays = 1
private let lateFromDays = 2
private let longOverdueFromDays = 7

public enum OverdueWash {
    // NB ADR 0065: the wash deepens 0.06, 0.09, 0.12 by days overdue and stops where the red due words keep 3:1.
    private static let bands: [(fromDays: Int, opacity: Double)] = [
        (singleDayFromDays, singleDayOpacity),
        (lateFromDays, lateOpacity),
        (longOverdueFromDays, longOverdueOpacity),
    ]

    public static func opacity(of task: WidgetSnapshotTask, on day: CalendarDate, isShown: Bool, isContrastIncreased: Bool) -> Double {
        let isWashed = isShown && !isContrastIncreased && task.state == .open && task.isOverdue
        guard isWashed, let dueDate = task.dueDate else { return noWashOpacity }
        let daysOverdue = day.days(since: dueDate)
        guard let band = bands.last(where: { daysOverdue >= $0.fromDays }) else { return noWashOpacity }
        return band.opacity
    }
}
