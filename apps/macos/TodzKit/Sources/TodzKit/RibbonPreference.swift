import Foundation

public struct RibbonPreference {
    public static let isOnStorageKey = "showsMenuBarRibbon"
    public static let cadenceStorageKey = "menuBarRibbonCadence"
    public static let isOnByDefault = false
    public static let cadenceByDefault = RibbonCadence.hourly

    private let domain: PersistentDomain

    public init(defaults: UserDefaults, domainName: String) {
        domain = PersistentDomain(defaults: defaults, name: domainName)
    }

    public static func registerDefaults(in defaults: UserDefaults) {
        defaults.register(defaults: [isOnStorageKey: isOnByDefault, cadenceStorageKey: cadenceByDefault.rawValue])
    }

    public static func pickerCadence(stored: String) -> RibbonCadence {
        guard let cadence = RibbonCadence(rawValue: stored) else { return cadenceByDefault }
        return cadence
    }

    var isOn: Bool {
        domain.value(forKey: Self.isOnStorageKey) as? Bool == true
    }

    var cadence: RibbonCadence? {
        guard let stored = domain.value(forKey: Self.cadenceStorageKey) else { return Self.cadenceByDefault }
        guard let text = stored as? String else { return nil }
        return RibbonCadence(rawValue: text)
    }
}
