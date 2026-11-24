import Foundation

private let privateFolderMode: mode_t = 0o700
private let openFlags = O_RDONLY | O_NOFOLLOW | O_DIRECTORY

enum FolderStatus: Equatable {
    case missing
    case owned
    case refused

    static func checked(_ folder: URL) -> FolderStatus {
        inspected(folder) { _ in }
    }

    static func madePrivate(_ folder: URL) -> FolderStatus {
        inspected(folder) { _ = fchmod($0, privateFolderMode) }
    }

    private static func inspected(_ folder: URL, whenOwned: (Int32) -> Void) -> FolderStatus {
        let descriptor = folder.withUnsafeFileSystemRepresentation { path in
            path.map { open($0, openFlags) }
        }
        guard let descriptor else { return .refused }
        guard descriptor >= 0 else { return errno == ENOENT ? .missing : .refused }
        defer { close(descriptor) }
        var status = stat()
        let isOwnedFolder = fstat(descriptor, &status) == 0 && status.st_mode & S_IFMT == S_IFDIR && status.st_uid == getuid()
        guard isOwnedFolder else { return .refused }
        whenOwned(descriptor)
        return .owned
    }
}
