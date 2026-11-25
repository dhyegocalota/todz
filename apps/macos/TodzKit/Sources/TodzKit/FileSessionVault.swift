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

    public func read() throws -> StoredSession? {
        guard FileManager.default.fileExists(atPath: sessionPath) else { return nil }
        let contents: Data
        do {
            contents = try Data(contentsOf: sessionFile)
        } catch {
            throw SessionVaultError.unreadable
        }
        guard !contents.isEmpty else { throw SessionVaultError.unreadable }
        guard let session = try? OwnerCoding.decoder().decode(StoredSession.self, from: contents) else { throw SessionVaultError.unbound }
        return session
    }

    public func write(_ session: StoredSession) throws {
        do {
            try PrivateFile.write(OwnerCoding.encoder().encode(session), to: sessionFile)
        } catch {
            throw SessionVaultError.unwritable
        }
    }

    public func bind(to origin: String) throws {
        let secret: String
        do {
            secret = try String(contentsOf: sessionFile, encoding: .utf8)
        } catch {
            throw SessionVaultError.unreadable
        }
        guard !secret.isEmpty else { throw SessionVaultError.unreadable }
        try write(StoredSession(secret: secret, origin: origin))
    }

    public func erase() throws {
        guard FileManager.default.fileExists(atPath: sessionPath) else { return }
        try FileManager.default.removeItem(at: sessionFile)
    }
}
