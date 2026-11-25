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
        fatalError("FileSessionVault.read of a bound session is not implemented")
    }

    public func write(_ session: StoredSession) throws {
        fatalError("FileSessionVault.write of a bound session is not implemented")
    }

    public func erase() throws {
        guard FileManager.default.fileExists(atPath: sessionPath) else { return }
        try FileManager.default.removeItem(at: sessionFile)
    }
}
