import Foundation

public enum MorningGlancePreference {
    public static let isOnStorageKey = "showsMorningGlance"
    public static let lastShownDayStorageKey = "lastMorningGlanceDay"
    public static let isOnByDefault = false

    public static func registerDefaults(in defaults: UserDefaults) {
        fatalError("MorningGlancePreference.registerDefaults is not implemented")
    }

    static func isOn(in defaults: UserDefaults) -> Bool {
        fatalError("MorningGlancePreference.isOn is not implemented")
    }

    static func lastShownDay(in defaults: UserDefaults) -> CalendarDate? {
        fatalError("MorningGlancePreference.lastShownDay is not implemented")
    }

    static func markShown(day: CalendarDate, in defaults: UserDefaults) {
        fatalError("MorningGlancePreference.markShown is not implemented")
    }
}
