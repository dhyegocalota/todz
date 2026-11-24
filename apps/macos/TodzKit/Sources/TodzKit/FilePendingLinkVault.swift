import Foundation

private let pendingFileName = "sign-in-link"

public struct FilePendingLinkVault: PendingLinkVault, Sendable {
    private let folder: URL

    public init(folder: URL) {
        self.folder = folder
    }

    private var pendingFile: URL {
        folder.appending(path: pendingFileName)
    }

    private var pendingPath: String {
        pendingFile.path(percentEncoded: false)
    }

    public func read() throws -> PendingSignInLink? {
        guard FileManager.default.fileExists(atPath: pendingPath) else { return nil }
        do {
            return try OwnerCoding.decoder().decode(PendingSignInLink.self, from: Data(contentsOf: pendingFile))
        } catch {
            throw PendingLinkVaultError.unreadable
        }
    }

    public func write(_ link: PendingSignInLink) throws {
        do {
            try PrivateFile.write(OwnerCoding.encoder().encode(link), to: pendingFile)
        } catch {
            throw PendingLinkVaultError.unwritable
        }
    }

    public func erase() throws {
        guard FileManager.default.fileExists(atPath: pendingPath) else { return }
        try FileManager.default.removeItem(at: pendingFile)
    }
}
