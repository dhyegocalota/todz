import Foundation

public struct MorningGlancePreference {
    public static let isOnStorageKey = "showsMorningGlance"
    public static let lastShownDayStorageKey = "lastMorningGlanceDay"
    public static let isOnByDefault = true

    private let domain: PersistentDomain

    public init(defaults: UserDefaults, domainName: String) {
        domain = PersistentDomain(defaults: defaults, name: domainName)
    }

    public static func registerDefaults(in defaults: UserDefaults) {
        defaults.register(defaults: [isOnStorageKey: isOnByDefault])
    }

    var isOn: Bool {
        guard let stored = domain.value(forKey: Self.isOnStorageKey) as? Bool else { return Self.isOnByDefault }
        return stored
    }

    var lastShownDay: CalendarDate? {
        domain.day(forKey: Self.lastShownDayStorageKey)
    }

    func markShown(day: CalendarDate) {
        domain.set(day.text, forKey: Self.lastShownDayStorageKey)
    }
}
