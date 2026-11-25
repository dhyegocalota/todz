import Foundation

private let topOfTheHour = DateComponents(minute: 0, second: 0)
private let tomorrowOffset = 1

public enum RibbonSchedule {
    public static func nextShowing(after instant: Date, cadence: RibbonCadence, closeMinutesAfterMidnight: Int?, timeZone: TimeZone) -> Date? {
        switch cadence {
        case .hourly:
            return gregorianCalendar(in: timeZone).nextDate(after: instant, matching: topOfTheHour, matchingPolicy: .nextTime)
        case .dayClose:
            guard let closeMinutesAfterMidnight else { return nil }
            return nextClose(after: instant, minutesAfterMidnight: closeMinutesAfterMidnight, timeZone: timeZone)
        case .agentChange:
            return nil
        }
    }

    private static func nextClose(after instant: Date, minutesAfterMidnight: Int, timeZone: TimeZone) -> Date {
        let today = CalendarDate.today(in: timeZone, at: instant)
        let closing = DayCloseSchedule.instant(day: today, minutesAfterMidnight: minutesAfterMidnight, timeZone: timeZone)
        guard closing <= instant else { return closing }
        return DayCloseSchedule.instant(day: today.adding(days: tomorrowOffset), minutesAfterMidnight: minutesAfterMidnight, timeZone: timeZone)
    }
}
