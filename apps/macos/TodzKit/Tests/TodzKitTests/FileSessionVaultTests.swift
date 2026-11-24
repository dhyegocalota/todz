import Foundation
import Testing
@testable import TodzKit

private let sessionFileName = "session"
private let privateMode = 0o600
private let unreadableMode = 0o000
private let folderNameWithASpace = "Application Support"

private func temporaryFolder() -> URL {
    FileManager.default.temporaryDirectory.appending(path: "todz-vault-\(UUID().uuidString)")
}

private func modeOfFile(at url: URL) throws -> Int {
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path())
    return try #require(attributes[.posixPermissions] as? Int)
}

@Suite final class FileSessionVaultTests {
    let folder = temporaryFolder()

    deinit {
        try? FileManager.default.removeItem(at: folder)
    }

    @Test func writesTheSecretWithModeSixHundredAndReadsItBack() throws {
        let vault = FileSessionVault(folder: folder)
        let secret = UUID().uuidString
        try vault.write(secret)
        #expect(try vault.read() == secret)
        #expect(try modeOfFile(at: folder.appending(path: sessionFileName)) == privateMode)
    }

    @Test func replacesTheSecretAtomicallyAndLeavesNoDraftBehind() throws {
        let vault = FileSessionVault(folder: folder)
        let secret = UUID().uuidString
        try vault.write(UUID().uuidString)
        try vault.write(secret)
        #expect(try vault.read() == secret)
        #expect(try FileManager.default.contentsOfDirectory(atPath: folder.path()) == [sessionFileName])
        #expect(try modeOfFile(at: folder.appending(path: sessionFileName)) == privateMode)
    }

    @Test func keepsTheSecretInAFolderWhoseNameHasASpace() throws {
        let vault = FileSessionVault(folder: folder.appending(path: folderNameWithASpace))
        let secret = UUID().uuidString
        try vault.write(secret)
        #expect(try vault.read() == secret)
        try vault.erase()
        #expect(try vault.read() == nil)
    }

    @Test func keepsTheSessionFileOutOfBackups() throws {
        try FileSessionVault(folder: folder).write(UUID().uuidString)
        let values = try folder.appending(path: sessionFileName).resourceValues(forKeys: [.isExcludedFromBackupKey])
        #expect(values.isExcludedFromBackup == true)
    }

    @Test func answersNilWhenNoSessionWasSaved() throws {
        #expect(try FileSessionVault(folder: folder).read() == nil)
    }

    @Test func throwsWhenTheFileExistsButCannotBeRead() throws {
        let vault = FileSessionVault(folder: folder)
        let fileURL = folder.appending(path: sessionFileName)
        try vault.write(UUID().uuidString)
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

    @Test func eraseRemovesTheSecretAndCanRunTwice() throws {
        let vault = FileSessionVault(folder: folder)
        try vault.write(UUID().uuidString)
        try vault.erase()
        #expect(try vault.read() == nil)
        #expect(FileManager.default.fileExists(atPath: folder.appending(path: sessionFileName).path()) == false)
        try vault.erase()
    }
}
