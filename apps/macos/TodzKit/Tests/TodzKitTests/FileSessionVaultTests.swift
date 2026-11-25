import Foundation
import Testing
@testable import TodzKit

private let sessionFileName = "session"
private let privateMode = 0o600
private let unreadableMode = 0o000
private let folderNameWithASpace = "Application Support"
private let origin = "https://todz.example.com"

private func temporaryFolder() -> URL {
    FileManager.default.temporaryDirectory.appending(path: "todz-vault-\(UUID().uuidString)")
}

private func modeOfFile(at url: URL) throws -> Int {
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path())
    return try #require(attributes[.posixPermissions] as? Int)
}

private func freshSession() -> StoredSession {
    StoredSession(secret: UUID().uuidString, origin: origin)
}

@Suite final class FileSessionVaultTests {
    let folder = temporaryFolder()

    deinit {
        try? FileManager.default.removeItem(at: folder)
    }

    @Test func writesTheSecretAndItsServerWithModeSixHundredAndReadsThemBack() throws {
        let vault = FileSessionVault(folder: folder)
        let session = freshSession()
        try vault.write(session)
        #expect(try vault.read() == session)
        #expect(try modeOfFile(at: folder.appending(path: sessionFileName)) == privateMode)
    }

    @Test func replacesTheSecretAtomicallyAndLeavesNoDraftBehind() throws {
        let vault = FileSessionVault(folder: folder)
        let session = freshSession()
        try vault.write(freshSession())
        try vault.write(session)
        #expect(try vault.read() == session)
        #expect(try FileManager.default.contentsOfDirectory(atPath: folder.path()) == [sessionFileName])
        #expect(try modeOfFile(at: folder.appending(path: sessionFileName)) == privateMode)
    }

    @Test func keepsTheSecretInAFolderWhoseNameHasASpace() throws {
        let vault = FileSessionVault(folder: folder.appending(path: folderNameWithASpace))
        let session = freshSession()
        try vault.write(session)
        #expect(try vault.read() == session)
        try vault.erase()
        #expect(try vault.read() == nil)
    }

    @Test func keepsTheSessionFileOutOfBackups() throws {
        try FileSessionVault(folder: folder).write(freshSession())
        let values = try folder.appending(path: sessionFileName).resourceValues(forKeys: [.isExcludedFromBackupKey])
        #expect(values.isExcludedFromBackup == true)
    }

    @Test func answersNilWhenNoSessionWasSaved() throws {
        #expect(try FileSessionVault(folder: folder).read() == nil)
    }

    @Test func throwsWhenTheFileExistsButCannotBeRead() throws {
        let vault = FileSessionVault(folder: folder)
        let fileURL = folder.appending(path: sessionFileName)
        try vault.write(freshSession())
        try FileManager.default.setAttributes([.posixPermissions: unreadableMode], ofItemAtPath: fileURL.path())
        defer { try? FileManager.default.setAttributes([.posixPermissions: privateMode], ofItemAtPath: fileURL.path()) }
        #expect(throws: (any Error).self) { try vault.read() }
    }

    @Test func throwsWhenTheFileIsEmpty() throws {
        let vault = FileSessionVault(folder: folder)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try Data().write(to: folder.appending(path: sessionFileName))
        #expect(throws: SessionVaultError.unreadable) { try vault.read() }
    }

    @Test func aSecretAloneAsAnEarlierBuildWroteItIsBoundToNoServer() throws {
        let vault = FileSessionVault(folder: folder)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try Data(UUID().uuidString.utf8).write(to: folder.appending(path: sessionFileName))
        #expect(throws: SessionVaultError.unbound) { try vault.read() }
    }

    @Test func bindingAnEarlierBuildsSecretWritesItBackBoundToTheServer() throws {
        let vault = FileSessionVault(folder: folder)
        let secret = UUID().uuidString
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try Data(secret.utf8).write(to: folder.appending(path: sessionFileName))
        try vault.bind(to: origin)
        #expect(try vault.read() == StoredSession(secret: secret, origin: origin))
        #expect(try modeOfFile(at: folder.appending(path: sessionFileName)) == privateMode)
    }

    @Test func eraseRemovesTheSecretAndCanRunTwice() throws {
        let vault = FileSessionVault(folder: folder)
        try vault.write(freshSession())
        try vault.erase()
        #expect(try vault.read() == nil)
        #expect(FileManager.default.fileExists(atPath: folder.appending(path: sessionFileName).path()) == false)
        try vault.erase()
    }
}
