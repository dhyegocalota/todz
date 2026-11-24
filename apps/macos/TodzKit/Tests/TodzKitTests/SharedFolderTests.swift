import Foundation
import Testing
@testable import TodzKit

private let appGroupKey = "TodzAppGroup"
private let appGroup = "TEAM123456.dev.todz"
private let groupContainer = URL(filePath: "/Users/maria/Library/Group Containers/TEAM123456.dev.todz", directoryHint: .isDirectory)
private let privateFolderMode = 0o700
private let openFolderMode = 0o755

private func expectNoFolderAndNoQuestion(info: [String: Any]) {
    var wasAsked = false
    let folder = SharedFolder.of(info: info) { _ in
        wasAsked = true
        return groupContainer
    }
    #expect(folder == nil)
    #expect(!wasAsked)
}

private func temporaryFolder() -> URL {
    FileManager.default.temporaryDirectory.appending(path: "todz-shared-\(UUID().uuidString)").appending(path: "dev.todz.widgets")
}

private func modeOfFile(at url: URL) throws -> Int {
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path(percentEncoded: false))
    return try #require(attributes[.posixPermissions] as? Int)
}

@Suite struct SharedFolderTests {
    @Test func theFolderIsTheContainerOfTheKeysGroup() {
        var askedGroups: [String] = []
        let folder = SharedFolder.of(info: [appGroupKey: appGroup]) { group in
            askedGroups.append(group)
            return groupContainer
        }
        #expect(folder == groupContainer)
        #expect(askedGroups == [appGroup])
    }

    @Test func aBundleWithoutTheKeyHasNoFolderAndAsksNoContainer() {
        expectNoFolderAndNoQuestion(info: [:])
    }

    @Test func aKeyThatIsNotTextHasNoFolderAndAsksNoContainer() {
        expectNoFolderAndNoQuestion(info: [appGroupKey: 1])
    }

    @Test func anEmptyKeyHasNoFolderAndAsksNoContainer() {
        expectNoFolderAndNoQuestion(info: [appGroupKey: ""])
    }

    @Test func aGroupWithoutAContainerHasNoFolder() {
        #expect(SharedFolder.of(info: [appGroupKey: appGroup]) { _ in nil } == nil)
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
