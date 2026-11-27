import Foundation

public struct WorkspaceLockPreference {
    public static let isOnStorageKey = "locksOtherWorkspaces"
    public static let timeoutStorageKey = "workspaceLockIdleMinutes"
    public static let isOnByDefault = false

    private let domain: PersistentDomain

    public init(defaults: UserDefaults, domainName: String) {
        domain = PersistentDomain(defaults: defaults, name: domainName)
    }

    public static func registerDefaults(in defaults: UserDefaults) {
        defaults.register(defaults: [isOnStorageKey: isOnByDefault, timeoutStorageKey: WorkspaceLockTimeout.standard.rawValue])
    }

    public var isOn: Bool {
        guard let stored = domain.value(forKey: Self.isOnStorageKey) else { return Self.isOnByDefault }
        return stored as? Bool == true
    }

    public var timeout: WorkspaceLockTimeout {
        guard let minutes = domain.value(forKey: Self.timeoutStorageKey) as? Int else { return .standard }
        guard let stored = WorkspaceLockTimeout(rawValue: minutes) else { return .standard }
        return stored
    }

    public func store(isOn: Bool) {
        domain.set(isOn, forKey: Self.isOnStorageKey)
    }

    public func store(timeout: WorkspaceLockTimeout) {
        domain.set(timeout.rawValue, forKey: Self.timeoutStorageKey)
    }
}
