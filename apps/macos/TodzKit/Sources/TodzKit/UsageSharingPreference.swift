import Foundation

public struct UsageSharingPreference {
    public static let isOnStorageKey = "sharesAnonymousUsage"
    public static let askedStorageKey = "askedAboutSharingUsage"
    public static let isOnByDefault = false

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

    public var hasBeenAsked: Bool {
        guard let stored = domain.value(forKey: Self.askedStorageKey) as? Bool else { return false }
        return stored
    }

    public func answer(isSharing: Bool) {
        domain.set(isSharing, forKey: Self.isOnStorageKey)
        domain.set(true, forKey: Self.askedStorageKey)
    }
}
