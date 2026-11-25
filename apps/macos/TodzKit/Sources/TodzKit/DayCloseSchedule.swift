import Foundation

public enum DayCloseSchedule {
    public static func decision(
        at now: Date,
        minutesAfterMidnight: Int,
        lastClosedDay: CalendarDate?,
        isOn: Bool,
        timeZone: TimeZone
    ) -> DayCloseDecision {
        fatalError("DayCloseSchedule.decision is not implemented")
    }

    public static func instant(day: CalendarDate, minutesAfterMidnight: Int, timeZone: TimeZone) -> Date {
        fatalError("DayCloseSchedule.instant is not implemented")
    }

    public static func minutesAfterMidnight(of instant: Date, timeZone: TimeZone) -> Int {
        fatalError("DayCloseSchedule.minutesAfterMidnight is not implemented")
    }
}
