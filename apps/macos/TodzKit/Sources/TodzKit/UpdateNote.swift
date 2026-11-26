import Foundation

public enum UpdateNote {
    public static let lastLaunchedVersionStorageKey = "lastLaunchedVersion"
    public static let pendingVersionStorageKey = "updatedToVersion"

    public static func pendingVersion(recorded: String?, current: String) -> String? {
        guard let recorded else { return nil }
        guard recorded != current else { return nil }
        return current
    }

    public static func recordLaunch(ofVersion current: String, defaults: UserDefaults) -> String? {
        let recorded = defaults.string(forKey: lastLaunchedVersionStorageKey)
        if let pending = pendingVersion(recorded: recorded, current: current) {
            defaults.set(pending, forKey: pendingVersionStorageKey)
        }
        defaults.set(current, forKey: lastLaunchedVersionStorageKey)
        return defaults.string(forKey: pendingVersionStorageKey)
    }

    public static func clearPendingVersion(defaults: UserDefaults) {
        defaults.removeObject(forKey: pendingVersionStorageKey)
    }
}
