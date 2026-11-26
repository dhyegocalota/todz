import Foundation
import Testing
@testable import TodzKit

@Suite struct ExclusiveRenameTests {
    private let folder = URL.temporaryDirectory.appending(path: UUID().uuidString)

    private func makeFolder(named name: String) throws -> URL {
        let url = folder.appending(path: name)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    @Test func aRenameIntoAFreeNameMovesTheFolder() throws {
        let staging = try makeFolder(named: "staging")
        let destination = folder.appending(path: "destination")
        try ExclusiveRename.perform(from: staging, to: destination)
        #expect(FileManager.default.fileExists(atPath: destination.path))
        #expect(!FileManager.default.fileExists(atPath: staging.path))
    }

    @Test func aRenameOntoAnExistingFolderRefusesAndChangesNothing() throws {
        let staging = try makeFolder(named: "staging")
        let destination = try makeFolder(named: "destination")
        #expect(throws: ExclusiveRenameFailure.self) { try ExclusiveRename.perform(from: staging, to: destination) }
        #expect(FileManager.default.fileExists(atPath: staging.path))
        #expect(FileManager.default.fileExists(atPath: destination.path))
    }

    @Test func aRenameOntoABrokenSymbolicLinkRefuses() throws {
        let staging = try makeFolder(named: "staging")
        let destination = folder.appending(path: "destination")
        try FileManager.default.createSymbolicLink(at: destination, withDestinationURL: folder.appending(path: "missing"))
        #expect(throws: ExclusiveRenameFailure.self) { try ExclusiveRename.perform(from: staging, to: destination) }
        #expect(FileManager.default.fileExists(atPath: staging.path))
    }
}
