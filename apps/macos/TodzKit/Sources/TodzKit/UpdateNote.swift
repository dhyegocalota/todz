import Foundation

public enum UpdateNote {
    public static let lastLaunchedVersionKey = "lastLaunchedVersion"
    public static let pendingVersionKey = "updatedToVersion"

    public static func pendingVersion(recorded: String?, current: String) -> String? {
        guard let recorded else { return nil }
        guard recorded != current else { return nil }
        return current
    }

    public static func recordLaunch(ofVersion current: String, defaults: UserDefaults) -> String? {
        nil
    }

    public static func clearPendingVersion(defaults: UserDefaults) {}
}
