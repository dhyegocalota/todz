import Foundation

public enum MorningGlancePreference {
    public static let isOnStorageKey = "showsMorningGlance"
    public static let lastShownDayStorageKey = "lastMorningGlanceDay"
    public static let isOnByDefault = false

    public static func registerDefaults(in defaults: UserDefaults) {
        defaults.register(defaults: [isOnStorageKey: isOnByDefault])
    }

    static func isOn(in defaults: UserDefaults) -> Bool {
        defaults.bool(forKey: isOnStorageKey)
    }

    static func lastShownDay(in defaults: UserDefaults) -> CalendarDate? {
        defaults.string(forKey: lastShownDayStorageKey).flatMap(CalendarDate.init(text:))
    }

    static func markShown(day: CalendarDate, in defaults: UserDefaults) {
        defaults.set(day.text, forKey: lastShownDayStorageKey)
    }
}
