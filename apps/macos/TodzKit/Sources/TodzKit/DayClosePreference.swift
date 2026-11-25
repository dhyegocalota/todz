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

    private let domain: PersistentDomain

    public init(defaults: UserDefaults, domainName: String) {
        domain = PersistentDomain(defaults: defaults, name: domainName)
    }

    public static func registerDefaults(in defaults: UserDefaults) {
        defaults.register(defaults: [isOnStorageKey: isOnByDefault, timeStorageKey: minutesAfterMidnightByDefault])
    }

    public static func pickerMinutes(stored minutes: Int) -> Int {
        guard minutesOfADay.contains(minutes) else { return minutesAfterMidnightByDefault }
        return minutes
    }

    var isOn: Bool {
        domain.value(forKey: Self.isOnStorageKey) as? Bool == true
    }

    var minutesAfterMidnight: Int? {
        guard let stored = domain.value(forKey: Self.timeStorageKey) else { return Self.minutesAfterMidnightByDefault }
        guard let minutes = stored as? Int, minutesOfADay.contains(minutes) else { return nil }
        return minutes
    }

    var lastClosedDay: CalendarDate? {
        domain.day(forKey: Self.lastClosedDayStorageKey)
    }

    func markClosed(day: CalendarDate) {
        domain.set(day.text, forKey: Self.lastClosedDayStorageKey)
    }
}
