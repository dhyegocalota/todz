import Foundation

private let minutesPerHour = 60
private let tomorrowOffset = 1
private let instantFailure = "a Gregorian calendar date always has a time of day"

private func gregorianCalendar(in timeZone: TimeZone) -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar
}

public enum DayCloseSchedule {
    // NB ADR 0055: the day closes at the owner's time or at the first chance after it the same day, never twice a day.
    public static func decision(
        at now: Date,
        minutesAfterMidnight: Int,
        lastClosedDay: CalendarDate?,
        isOn: Bool,
        timeZone: TimeZone
    ) -> DayCloseDecision {
        guard isOn else { return .off }
        let today = CalendarDate.today(in: timeZone, at: now)
        guard lastClosedDay != today else {
            return .doneToday(next: instant(day: today.adding(days: tomorrowOffset), minutesAfterMidnight: minutesAfterMidnight, timeZone: timeZone))
        }
        let closing = instant(day: today, minutesAfterMidnight: minutesAfterMidnight, timeZone: timeZone)
        guard now >= closing else { return .notYet(next: closing) }
        return .due
    }

    public static func instant(day: CalendarDate, minutesAfterMidnight: Int, timeZone: TimeZone) -> Date {
        let components = DateComponents(
            year: day.year,
            month: day.month,
            day: day.day,
            hour: minutesAfterMidnight / minutesPerHour,
            minute: minutesAfterMidnight % minutesPerHour
        )
        guard let instant = gregorianCalendar(in: timeZone).date(from: components) else { preconditionFailure(instantFailure) }
        return instant
    }

    public static func minutesAfterMidnight(of instant: Date, timeZone: TimeZone) -> Int {
        let components = gregorianCalendar(in: timeZone).dateComponents([.hour, .minute], from: instant)
        guard let hour = components.hour, let minute = components.minute else { preconditionFailure(instantFailure) }
        return hour * minutesPerHour + minute
    }
}
