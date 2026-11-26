import Foundation

private let homeApplicationsFolderName = "Applications"

public enum ApplicationsMove {
    public static let declinedVersionStorageKey = "declinedApplicationsMoveVersion"
    public static let destinationFolderPath = "/Applications"
    public static let bundleFileName = "Todz.app"

    // NB ADR 0105: only a Release build that starts Sparkle is ever asked, once per version, and never when it already runs from an Applications folder.
    public static func shouldOffer(
        bundlePath: String,
        isTranslocated: Bool,
        homeDirectory: String,
        currentVersion: String,
        declinedVersion: String?,
        hasUpdateFeed: Bool,
        isDebugBuild: Bool
    ) -> Bool {
        guard !isDebugBuild else { return false }
        guard hasUpdateFeed else { return false }
        guard declinedVersion != currentVersion else { return false }
        guard !isTranslocated else { return true }
        let folderPath = URL(filePath: bundlePath).deletingLastPathComponent().path
        let applicationsFolders = [destinationFolderPath, "\(homeDirectory)/\(homeApplicationsFolderName)"]
        return !applicationsFolders.contains(folderPath)
    }

    public static func declinedVersion(defaults: UserDefaults) -> String? {
        defaults.string(forKey: declinedVersionStorageKey)
    }

    public static func decline(version: String, defaults: UserDefaults) {
        defaults.set(version, forKey: declinedVersionStorageKey)
    }
}
