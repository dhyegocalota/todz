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
        fatalError("RibbonPreference.pickerCadence is not implemented")
    }

    var isOn: Bool {
        fatalError("RibbonPreference.isOn is not implemented")
    }

    var cadence: RibbonCadence? {
        fatalError("RibbonPreference.cadence is not implemented")
    }
}
