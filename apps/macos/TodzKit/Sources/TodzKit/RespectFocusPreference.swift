import Foundation

public struct RespectFocusPreference {
    public static let isOnStorageKey = "respectsFocus"
    public static let isOnByDefault = false

    private let domain: PersistentDomain

    public init(defaults: UserDefaults, domainName: String) {
        domain = PersistentDomain(defaults: defaults, name: domainName)
    }

    public static func registerDefaults(in defaults: UserDefaults) {
        defaults.register(defaults: [isOnStorageKey: isOnByDefault])
    }

    public var isOn: Bool {
        domain.value(forKey: Self.isOnStorageKey) as? Bool == true
    }
}
