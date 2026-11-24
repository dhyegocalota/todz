import Foundation
import Testing
@testable import TodzKit

private let openFolderMode = 0o755

private func temporaryFolder() -> URL {
    FileManager.default.temporaryDirectory.appending(path: "todz-status-\(UUID().uuidString)").appending(path: "folder")
}

private func modeOfFile(at url: URL) throws -> Int {
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path(percentEncoded: false))
    return try #require(attributes[.posixPermissions] as? Int)
}

@Suite struct FolderStatusTests {
    @Test func aFolderOwnedByTheCallerIsOwnedWhateverItsMode() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder.deletingLastPathComponent()) }
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.posixPermissions: openFolderMode])
        #expect(FolderStatus.checked(folder) == .owned)
        #expect(try modeOfFile(at: folder) == openFolderMode)
    }

    @Test func aFolderThatIsNotThereIsMissing() {
        #expect(FolderStatus.checked(temporaryFolder()) == .missing)
    }

    @Test func aSymlinkIsRefused() throws {
        let folder = temporaryFolder()
        let target = folder.deletingLastPathComponent().appending(path: "elsewhere")
        defer { try? FileManager.default.removeItem(at: folder.deletingLastPathComponent()) }
        try FileManager.default.createDirectory(at: target, withIntermediateDirectories: true)
        try FileManager.default.createSymbolicLink(at: folder, withDestinationURL: target)
        #expect(FolderStatus.checked(folder) == .refused)
    }

    @Test func aFileIsRefused() throws {
        let folder = temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder.deletingLastPathComponent()) }
        try FileManager.default.createDirectory(at: folder.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data().write(to: folder)
        #expect(FolderStatus.checked(folder) == .refused)
    }
}
