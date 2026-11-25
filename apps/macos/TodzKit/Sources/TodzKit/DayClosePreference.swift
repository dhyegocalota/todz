import Foundation

private let minutesOfADay = 0..<(24 * 60)

public enum DayClosePreference {
    public static let isOnStorageKey = "closesTheDay"
    public static let timeStorageKey = "dayCloseMinutes"
    public static let lastClosedDayStorageKey = "lastClosedDay"
    public static let isOnByDefault = false
    // NB ADR 0055: the day closes at 18:00 in the Mac's time zone until the owner picks another time.
    public static let minutesAfterMidnightByDefault = 18 * 60

    public static func registerDefaults(in defaults: UserDefaults) {
        defaults.register(defaults: [isOnStorageKey: isOnByDefault, timeStorageKey: minutesAfterMidnightByDefault])
    }

    static func isOn(in defaults: UserDefaults) -> Bool {
        defaults.bool(forKey: isOnStorageKey)
    }

    static func minutesAfterMidnight(in defaults: UserDefaults) -> Int? {
        let minutes = defaults.integer(forKey: timeStorageKey)
        guard minutesOfADay.contains(minutes) else { return nil }
        return minutes
    }

    public static func pickerMinutes(stored minutes: Int) -> Int {
        guard minutesOfADay.contains(minutes) else { return minutesAfterMidnightByDefault }
        return minutes
    }

    static func lastClosedDay(in defaults: UserDefaults) -> CalendarDate? {
        defaults.string(forKey: lastClosedDayStorageKey).flatMap(CalendarDate.init(text:))
    }

    static func markClosed(day: CalendarDate, in defaults: UserDefaults) {
        defaults.set(day.text, forKey: lastClosedDayStorageKey)
    }
}
