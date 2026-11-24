import Foundation

public struct FilePendingLinkVault: PendingLinkVault, Sendable {
    private let folder: URL

    public init(folder: URL) {
        self.folder = folder
    }

    public func read() throws -> PendingSignInLink? {
        nil
    }

    public func write(_ link: PendingSignInLink) throws {}

    public func erase() throws {}
}
