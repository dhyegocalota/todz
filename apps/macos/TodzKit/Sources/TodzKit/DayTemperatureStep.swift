import Foundation

private let noonHour = 12
private let afternoonHour = 15
private let eveningHour = 18
private let plainOpacity = 1.0
private let noonOpacity = 0.85
private let afternoonOpacity = 0.75
private let eveningOpacity = 0.65
private let nextDayOffset = 1
private let instantFailure = "a Gregorian calendar date always has a time of day"
private let boundaryFailure = "a day always ends after any instant inside it"

public enum DayTemperatureStep: Sendable, Equatable {
    case plain
    case noon
    case afternoon
    case evening

    private static let startHours: [(step: DayTemperatureStep, hour: Int)] = [
        (.noon, noonHour),
        (.afternoon, afternoonHour),
        (.evening, eveningHour),
    ]

    public static func step(at instant: Date, in timeZone: TimeZone) -> DayTemperatureStep {
        let hour = gregorianCalendar(in: timeZone).component(.hour, from: instant)
        guard let started = startHours.last(where: { hour >= $0.hour }) else { return .plain }
        return started.step
    }

    public static func boundaries(on day: CalendarDate, in timeZone: TimeZone) -> [Date] {
        let calendar = gregorianCalendar(in: timeZone)
        let stepBoundaries = startHours.map { instant(on: day, hour: $0.hour, calendar: calendar) }
        let nextDayMidday = instant(on: day.adding(days: nextDayOffset), hour: noonHour, calendar: calendar)
        return stepBoundaries + [calendar.startOfDay(for: nextDayMidday)]
    }

    public static func nextBoundary(after instant: Date, in timeZone: TimeZone) -> Date {
        let day = CalendarDate.today(in: timeZone, at: instant)
        guard let next = boundaries(on: day, in: timeZone).first(where: { $0 > instant }) else { preconditionFailure(boundaryFailure) }
        return next
    }

    private static func instant(on day: CalendarDate, hour: Int, calendar: Calendar) -> Date {
        let components = DateComponents(year: day.year, month: day.month, day: day.day, hour: hour)
        guard let instant = calendar.date(from: components) else { preconditionFailure(instantFailure) }
        return instant
    }

    // NB ADR 0065: the count dims 0.85, 0.75, 0.65 after noon, 15:00 and 18:00, and only while a count shows and nothing quiets it.
    public static func countOpacity(
        step: DayTemperatureStep,
        isSettingOn: Bool,
        isQuiet: Bool,
        isContrastIncreased: Bool,
        openCount: Int?
    ) -> Double {
        let isToneAllowed = isSettingOn && !isQuiet && !isContrastIncreased
        guard isToneAllowed, let openCount, openCount > 0 else { return plainOpacity }
        return step.opacity
    }

    private var opacity: Double {
        switch self {
        case .plain: plainOpacity
        case .noon: noonOpacity
        case .afternoon: afternoonOpacity
        case .evening: eveningOpacity
        }
    }
}
