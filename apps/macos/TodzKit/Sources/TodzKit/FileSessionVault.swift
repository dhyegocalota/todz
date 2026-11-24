import Foundation

private let sessionFileName = "session"

// NB ADR 0025: the session secret lives alone in a 0600 file, written atomically, until the app has a signing team.
public struct FileSessionVault: SessionVault, Sendable {
    private let folder: URL

    public init(folder: URL) {
        self.folder = folder
    }

    private var sessionFile: URL {
        folder.appending(path: sessionFileName)
    }

    private var sessionPath: String {
        sessionFile.path(percentEncoded: false)
    }

    public func read() throws -> String? {
        guard FileManager.default.fileExists(atPath: sessionPath) else { return nil }
        let secret: String
        do {
            secret = try String(contentsOf: sessionFile, encoding: .utf8)
        } catch {
            throw SessionVaultError.unreadable
        }
        guard !secret.isEmpty else { throw SessionVaultError.unreadable }
        return secret
    }

    public func write(_ secret: String) throws {
        do {
            try PrivateFile.write(Data(secret.utf8), to: sessionFile)
        } catch {
            throw SessionVaultError.unwritable
        }
    }

    public func erase() throws {
        guard FileManager.default.fileExists(atPath: sessionPath) else { return }
        try FileManager.default.removeItem(at: sessionFile)
    }
}
