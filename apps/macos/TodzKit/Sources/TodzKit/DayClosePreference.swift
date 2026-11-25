import Foundation

private let minutesOfADay = 0..<(DayCloseSchedule.hoursPerDay * DayCloseSchedule.minutesPerHour)
private let defaultHour = 18

public struct DayClosePreference {
    public static let isOnStorageKey = "closesTheDay"
    public static let timeStorageKey = "dayCloseMinutes"
    public static let lastClosedDayStorageKey = "lastClosedDay"
    public static let isOnByDefault = false
    // NB ADR 0055: the day closes at 18:00 in the Mac's time zone until the owner picks another time.
    public static let minutesAfterMidnightByDefault = defaultHour * DayCloseSchedule.minutesPerHour

    private let defaults: UserDefaults
    private let domainName: String

    public init(defaults: UserDefaults, domainName: String) {
        self.defaults = defaults
        self.domainName = domainName
    }

    var isOn: Bool {
        defaults.bool(forKey: Self.isOnStorageKey)
    }

    var minutesAfterMidnight: Int? {
        let minutes = defaults.integer(forKey: Self.timeStorageKey)
        guard minutesOfADay.contains(minutes) else { return nil }
        return minutes
    }

    var lastClosedDay: CalendarDate? {
        defaults.string(forKey: Self.lastClosedDayStorageKey).flatMap(CalendarDate.init(text:))
    }

    func markClosed(day: CalendarDate) {
        defaults.set(day.text, forKey: Self.lastClosedDayStorageKey)
    }

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
