import Foundation

public struct DayTemperaturePreference {
    public static let isOnStorageKey = "showsDayTemperature"
    public static let isOnByDefault = true

    private let domain: PersistentDomain

    public init(defaults: UserDefaults, domainName: String) {
        domain = PersistentDomain(defaults: defaults, name: domainName)
    }

    public static func registerDefaults(in defaults: UserDefaults) {
        defaults.register(defaults: [isOnStorageKey: isOnByDefault])
    }

    public var isOn: Bool {
        guard let stored = domain.value(forKey: Self.isOnStorageKey) as? Bool else { return Self.isOnByDefault }
        return stored
    }
}
