import Foundation
import Testing
@testable import TodzKit

private let pendingFileName = "sign-in-link"
private let privateMode = 0o600
private let folderNameWithASpace = "Application Support"
private let brokenJSON = "{"

private func temporaryFolder() -> URL {
    FileManager.default.temporaryDirectory.appending(path: "todz-pending-\(UUID().uuidString)")
}

private func modeOfFile(at url: URL) throws -> Int {
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path())
    return try #require(attributes[.posixPermissions] as? Int)
}

private func pendingLink(email: String = "maria@example.com") -> PendingSignInLink {
    PendingSignInLink(email: email, verifier: String(repeating: "A", count: 43), expiresAt: Date(timeIntervalSince1970: 1_700_000_000))
}

@Suite final class FilePendingLinkVaultTests {
    let folder = temporaryFolder()

    deinit {
        try? FileManager.default.removeItem(at: folder)
    }

    @Test func writesTheLinkWithModeSixHundredAndReadsItBack() throws {
        let vault = FilePendingLinkVault(folder: folder)
        try vault.write(pendingLink())
        #expect(try vault.read() == pendingLink())
        #expect(try modeOfFile(at: folder.appending(path: pendingFileName)) == privateMode)
    }

    @Test func replacesTheLinkAndLeavesNoDraftBehind() throws {
        let vault = FilePendingLinkVault(folder: folder)
        try vault.write(pendingLink(email: "first@example.com"))
        try vault.write(pendingLink())
        #expect(try vault.read() == pendingLink())
        #expect(try FileManager.default.contentsOfDirectory(atPath: folder.path()) == [pendingFileName])
    }

    @Test func keepsTheLinkInAFolderWhoseNameHasASpaceAndOutOfBackups() throws {
        let vault = FilePendingLinkVault(folder: folder.appending(path: folderNameWithASpace))
        try vault.write(pendingLink())
        #expect(try vault.read() == pendingLink())
        let file = folder.appending(path: folderNameWithASpace).appending(path: pendingFileName)
        #expect(try file.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true)
    }

    @Test func answersNilWhenNoLinkWasSaved() throws {
        #expect(try FilePendingLinkVault(folder: folder).read() == nil)
    }

    @Test func throwsWhenTheFileIsNotALink() throws {
        let vault = FilePendingLinkVault(folder: folder)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try Data(brokenJSON.utf8).write(to: folder.appending(path: pendingFileName))
        #expect(throws: PendingLinkVaultError.unreadable) { try vault.read() }
    }

    @Test func eraseRemovesTheLinkAndCanRunTwice() throws {
        let vault = FilePendingLinkVault(folder: folder)
        try vault.write(pendingLink())
        try vault.erase()
        #expect(try vault.read() == nil)
        try vault.erase()
    }
}

@Suite struct InMemoryPendingLinkVaultTests {
    @Test func keepsTheLinkUntilItIsErased() throws {
        let vault = InMemoryPendingLinkVault()
        try vault.write(pendingLink())
        #expect(try vault.read() == pendingLink())
        try vault.erase()
        #expect(try vault.read() == nil)
    }
}
