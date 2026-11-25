import Foundation

public struct MorningGlancePreference {
    public static let isOnStorageKey = "showsMorningGlance"
    public static let lastShownDayStorageKey = "lastMorningGlanceDay"
    public static let isOnByDefault = false

    private let defaults: UserDefaults
    private let domainName: String

    public init(defaults: UserDefaults, domainName: String) {
        self.defaults = defaults
        self.domainName = domainName
    }

    public static func registerDefaults(in defaults: UserDefaults) {
        defaults.register(defaults: [isOnStorageKey: isOnByDefault])
    }

    var isOn: Bool {
        defaults.bool(forKey: Self.isOnStorageKey)
    }

    var lastShownDay: CalendarDate? {
        defaults.string(forKey: Self.lastShownDayStorageKey).flatMap(CalendarDate.init(text:))
    }

    func markShown(day: CalendarDate) {
        defaults.set(day.text, forKey: Self.lastShownDayStorageKey)
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
