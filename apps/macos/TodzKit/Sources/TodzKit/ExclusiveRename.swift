import Darwin
import Foundation

public struct ExclusiveRenameFailure: Error {
    public let code: Int32
}

public enum ExclusiveRename {
    public static func perform(from source: URL, to destination: URL) throws {
        guard renamex_np(source.path, destination.path, UInt32(RENAME_EXCL)) == 0 else { throw ExclusiveRenameFailure(code: errno) }
    }
}
