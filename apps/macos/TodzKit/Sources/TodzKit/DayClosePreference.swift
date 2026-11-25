import Foundation

public enum DayClosePreference {
    public static let isOnStorageKey = "closesTheDay"
    public static let timeStorageKey = "dayCloseMinutes"
    public static let lastClosedDayStorageKey = "lastClosedDay"
    public static let isOnByDefault = false
    // NB ADR 0055: the day closes at 18:00 in the Mac's time zone until the owner picks another time.
    public static let minutesAfterMidnightByDefault = 18 * 60

    public static func registerDefaults(in defaults: UserDefaults) {
        fatalError("DayClosePreference.registerDefaults is not implemented")
    }

    static func isOn(in defaults: UserDefaults) -> Bool {
        fatalError("DayClosePreference.isOn is not implemented")
    }

    static func minutesAfterMidnight(in defaults: UserDefaults) -> Int {
        fatalError("DayClosePreference.minutesAfterMidnight is not implemented")
    }

    static func lastClosedDay(in defaults: UserDefaults) -> CalendarDate? {
        fatalError("DayClosePreference.lastClosedDay is not implemented")
    }

    static func markClosed(day: CalendarDate, in defaults: UserDefaults) {
        fatalError("DayClosePreference.markClosed is not implemented")
    }
}
