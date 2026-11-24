import Foundation

private let sessionFileName = "session"
private let draftFilePrefix = ".session-"
private let privateMode: mode_t = 0o600
private let draftFlags = O_WRONLY | O_CREAT | O_EXCL

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
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let draftPath = folder.appending(path: draftFilePrefix + UUID().uuidString).path(percentEncoded: false)
        let descriptor = open(draftPath, draftFlags, privateMode)
        guard descriptor >= 0 else { throw SessionVaultError.unwritable }
        defer { unlink(draftPath) }
        let draft = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
        try draft.write(contentsOf: Data(secret.utf8))
        try draft.synchronize()
        try draft.close()
        guard rename(draftPath, sessionPath) == 0 else { throw SessionVaultError.unwritable }
    }

    public func erase() throws {
        guard FileManager.default.fileExists(atPath: sessionPath) else { return }
        try FileManager.default.removeItem(at: sessionFile)
    }
}
