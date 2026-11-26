import Darwin
import Foundation

public struct FileIdentity: Hashable, Sendable {
    private let device: Int32
    private let inode: UInt64

    public static func of(_ url: URL) -> FileIdentity? {
        var status = stat()
        guard stat(url.path, &status) == 0 else { return nil }
        return FileIdentity(device: status.st_dev, inode: status.st_ino)
    }
}
