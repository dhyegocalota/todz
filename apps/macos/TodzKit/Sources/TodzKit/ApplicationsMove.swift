import Foundation

private let systemApplicationsPath = "/Applications"
private let homeApplicationsFolderName = "Applications"
private let bundleFileName = "Todz.app"

public enum ApplicationsMove {
    public static let declinedVersionStorageKey = "declinedApplicationsMoveVersion"
    public static let destinationPath = "\(systemApplicationsPath)/\(bundleFileName)"

    public static func shouldOffer(
        bundlePath: String,
        isTranslocated: Bool,
        homeDirectory: String,
        currentVersion: String,
        declinedVersion: String?,
        hasUpdateFeed: Bool
    ) -> Bool {
        guard hasUpdateFeed else { return false }
        guard declinedVersion != currentVersion else { return false }
        guard !isTranslocated else { return true }
        let folderPath = URL(filePath: bundlePath).deletingLastPathComponent().path
        let applicationsFolders = [systemApplicationsPath, "\(homeDirectory)/\(homeApplicationsFolderName)"]
        return !applicationsFolders.contains(folderPath)
    }

    public static func declinedVersion(defaults: UserDefaults) -> String? {
        defaults.string(forKey: declinedVersionStorageKey)
    }

    public static func decline(version: String, defaults: UserDefaults) {
        defaults.set(version, forKey: declinedVersionStorageKey)
    }
}
