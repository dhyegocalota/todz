import Darwin
import Foundation

public enum QuarantineRemovalFailure: Error {
    case unreadable
    case kept
}

private final class EnumerationFailures: @unchecked Sendable {
    var hasFailed = false
}

public enum QuarantineRemoval {
    public static let attributeName = "com.apple.quarantine"

    public static func remove(from root: URL) throws {
        let failures = EnumerationFailures()
        let errorHandler: (URL, any Error) -> Bool = { _, _ in
            failures.hasFailed = true
            return true
        }
        guard FileManager.default.fileExists(atPath: root.path) else { throw QuarantineRemovalFailure.unreadable }
        guard let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil, errorHandler: errorHandler) else { throw QuarantineRemovalFailure.unreadable }
        let paths = ([root] + enumerator.compactMap { $0 as? URL }).map(\.path)
        guard !failures.hasFailed else { throw QuarantineRemovalFailure.unreadable }
        let isStripped = paths.allSatisfy { removexattr($0, attributeName, XATTR_NOFOLLOW) == 0 || errno == ENOATTR }
        guard isStripped else { throw QuarantineRemovalFailure.kept }
    }
}
