import Foundation

private let relativePathKey = "TodzSharedFolder"
private let pathSeparator = "/"
private let parentFolderComponent = ".."
private let privateFolderMode = 0o700

public enum SharedFolder {
    // NB ADR 0033: the shared folder is a path relative to the account's home, never to the sandbox's.
    public static func of(info: [String: Any], home: URL) -> URL? {
        guard let relativePath = info[relativePathKey] as? String else { return nil }
        let components = relativePath.split(separator: pathSeparator)
        let isUnderTheHome = !relativePath.hasPrefix(pathSeparator) && !components.isEmpty && !components.contains { $0 == parentFolderComponent }
        guard isUnderTheHome else { return nil }
        return home.appending(path: relativePath, directoryHint: .isDirectory)
    }

    public static func of(bundle: Bundle) -> URL? {
        guard let info = bundle.infoDictionary, let home = accountHome else { return nil }
        return of(info: info, home: home)
    }

    public static var accountHome: URL? {
        guard let account = getpwuid(getuid()), let directory = account.pointee.pw_dir else { return nil }
        return URL(filePath: String(cString: directory), directoryHint: .isDirectory)
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
