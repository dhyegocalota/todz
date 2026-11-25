import Foundation

public struct MenuBarOnlyPreference {
    public static let isOnStorageKey = "keepsInMenuBarWhenClosed"
    public static let isOnByDefault = true

    private let domain: PersistentDomain

    public init(defaults: UserDefaults, domainName: String) {
        domain = PersistentDomain(defaults: defaults, name: domainName)
    }

    public static func registerDefaults(in defaults: UserDefaults) {
        defaults.register(defaults: [isOnStorageKey: isOnByDefault])
    }

    public var isOn: Bool {
        fatalError("MenuBarOnlyPreference.isOn is not implemented")
    }
}
