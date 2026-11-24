import Foundation
import Testing
@testable import TodzKit

private let relativePathKey = "TodzSharedFolder"
private let relativePath = "Library/Application Support/dev.todz.widgets"
private let home = URL(filePath: "/Users/maria", directoryHint: .isDirectory)
private let privateFolderMode = 0o700
private let openFolderMode = 0o755
private let pathsOutsideTheHome = ["", "/", "/Library/Application Support/dev.todz.widgets", "Library/../../bob", ".."]

private func temporaryFolder() -> URL {
    FileManager.default.temporaryDirectory.appending(path: "todz-shared-\(UUID().uuidString)").appending(path: "dev.todz.widgets")
}

private func modeOfFile(at url: URL) throws -> Int {
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path(percentEncoded: false))
    return try #require(attributes[.posixPermissions] as? Int)
}

@Suite struct SharedFolderTests {
    @Test func theFolderIsTheKeysPathUnderTheHome() throws {
        let folder = try #require(SharedFolder.of(info: [relativePathKey: relativePath], home: home))
        #expect(folder.path(percentEncoded: false) == "/Users/maria/Library/Application Support/dev.todz.widgets/")
    }

    @Test func aBundleWithoutTheKeyHasNoFolder() {
        #expect(SharedFolder.of(info: [:], home: home) == nil)
    }

    @Test func aKeyThatIsNotTextHasNoFolder() {
        #expect(SharedFolder.of(info: [relativePathKey: 1], home: home) == nil)
    }

    @Test(arguments: pathsOutsideTheHome)
    func aPathThatLeavesTheHomeHasNoFolder(path: String) {
        #expect(SharedFolder.of(info: [relativePathKey: path], home: home) == nil)
    }

    @Test func theHomeIsTheAccountsNotTheProcesss() throws {
        let accountHome = try #require(SharedFolder.accountHome)
        let expected = try #require(NSHomeDirectoryForUser(NSUserName()))
        #expect(accountHome.standardizedFileURL.path(percentEncoded: false) == URL(filePath: expected, directoryHint: .isDirectory).standardizedFileURL.path(percentEncoded: false))
    }

    @Test func aCreatedFolderIsPrivate() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder.deletingLastPathComponent()) }
        let created = try #require(SharedFolder.created(folder))
        #expect(created == folder)
        #expect(try modeOfFile(at: folder) == privateFolderMode)
    }

    @Test func aFolderThatExistsIsKept() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder.deletingLastPathComponent()) }
        _ = SharedFolder.created(folder)
        #expect(SharedFolder.created(folder) == folder)
    }

    @Test func aFolderThatExistsOpenToOthersIsMadePrivate() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder.deletingLastPathComponent()) }
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.posixPermissions: openFolderMode])
        #expect(SharedFolder.created(folder) == folder)
        #expect(try modeOfFile(at: folder) == privateFolderMode)
    }

    @Test func anOwnedFolderIsVerifiedWithoutChangingItsMode() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder.deletingLastPathComponent()) }
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.posixPermissions: openFolderMode])
        #expect(SharedFolder.owned(folder) == folder)
        #expect(try modeOfFile(at: folder) == openFolderMode)
    }

    @Test func aSymlinkedFolderIsRefusedAndItsTargetLeftAlone() throws {
        let folder = temporaryFolder()
        let target = folder.deletingLastPathComponent().appending(path: "elsewhere")
        defer { try? FileManager.default.removeItem(at: folder.deletingLastPathComponent()) }
        try FileManager.default.createDirectory(at: target, withIntermediateDirectories: true, attributes: [.posixPermissions: openFolderMode])
        try FileManager.default.createSymbolicLink(at: folder, withDestinationURL: target)
        #expect(SharedFolder.created(folder) == nil)
        #expect(try modeOfFile(at: target) == openFolderMode)
    }

    @Test func aFileInTheFolderPlaceCannotBeCreated() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder.deletingLastPathComponent()) }
        try FileManager.default.createDirectory(at: folder.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data().write(to: folder)
        #expect(SharedFolder.created(folder) == nil)
    }
}
