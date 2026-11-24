import Foundation

private let appGroupKey = "TodzAppGroup"
private let privateFolderMode = 0o700

public enum SharedFolder {
    // NB ADR 0035: the shared folder is the container of the App Group that the Info.plist names.
    public static func of(info: [String: Any], container: (String) -> URL?) -> URL? {
        guard let appGroup = info[appGroupKey] as? String, !appGroup.isEmpty else { return nil }
        return container(appGroup)
    }

    public static func of(bundle: Bundle) -> URL? {
        guard let info = bundle.infoDictionary else { return nil }
        return of(info: info) { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: $0) }
    }

    public static func created(_ folder: URL) -> URL? {
        let attributes: [FileAttributeKey: Any] = [.posixPermissions: privateFolderMode]
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: attributes)
        } catch {
            return nil
        }
        guard FolderStatus.madePrivate(folder) == .owned else { return nil }
        return folder
    }

    public static func owned(_ folder: URL) -> URL? {
        guard FolderStatus.checked(folder) == .owned else { return nil }
        return folder
    }
}
