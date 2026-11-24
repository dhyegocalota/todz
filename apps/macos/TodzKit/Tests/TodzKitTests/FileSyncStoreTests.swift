import Foundation
import Testing
@testable import TodzKit

private let ownerFileName = "owner.json"
private let projectsFolderName = "projects"
private let outboxFileName = "outbox.json"
private let privateFileMode = 0o600
private let privateFolderMode = 0o700
private let projectIdentifier = "project-1"
private let workspaceIdentifier = "workspace-1"
private let escapingIdentifier = "../escape"
private let brokenJSON = "{"
private let outboxBytes = Data("outbox".utf8)
private let largeTaskCount = 1_000
private let timedWriteCount = 5
private let medianBudget = Duration.milliseconds(100)
private let invalidIdentifiers = ["../escape", "", "a/b", "a.b", String(repeating: "a", count: 65)]

private func temporaryFolder() -> URL {
    FileManager.default.temporaryDirectory.appending(path: "todz-sync-\(UUID().uuidString)").appending(path: "Application Support")
}

private func modeOfFile(at url: URL) throws -> Int {
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path(percentEncoded: false))
    return try #require(attributes[.posixPermissions] as? Int)
}

private func isExcludedFromBackup(_ url: URL) throws -> Bool? {
    try url.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup
}

private func ownerCache() throws -> OwnerCache {
    let project = OwnerFixtures.projectJSON(identifier: projectIdentifier, name: "Inbox", isInbox: true)
    let workspace = try OwnerFixtures.decoded(
        Workspace.self, from: OwnerFixtures.workspaceJSON(identifier: workspaceIdentifier, name: "Home", projects: [project]))
    return OwnerCache(ownerIdentifier: "owner-1", workspaces: [workspace], activeWorkspaceIdentifier: workspaceIdentifier)
}

private func projectCache(taskCount: Int = 2) -> ProjectCache {
    let tasks = (1...taskCount).map { OwnerFixtures.openTask(number: $0) }
    return ProjectCache(projectIdentifier: projectIdentifier, cursor: 7, tasks: tasks)
}

@Suite final class FileSyncStoreTests {
    let folder = temporaryFolder()

    var container: URL {
        folder.deletingLastPathComponent()
    }

    var store: FileSyncStore {
        FileSyncStore(folder: folder)
    }

    deinit {
        try? FileManager.default.removeItem(at: container)
    }

    @Test func answersNilForEveryReadWhenNothingWasWritten() throws {
        #expect(try store.readOwner() == nil)
        #expect(try store.readProject(identifier: projectIdentifier) == nil)
        #expect(try store.readOutbox() == nil)
    }

    @Test func readsBackWhatEachWriteSaved() throws {
        let owner = try ownerCache()
        let project = projectCache()
        try store.writeOwner(owner)
        try store.writeProject(project)
        try store.writeOutbox(outboxBytes)
        #expect(try store.readOwner() == owner)
        #expect(try store.readProject(identifier: projectIdentifier) == project)
        #expect(try store.readOutbox() == outboxBytes)
    }

    @Test func keepsFilesPrivateAndOutOfBackups() throws {
        try store.writeOwner(try ownerCache())
        try store.writeProject(projectCache())
        try store.writeOutbox(outboxBytes)
        let files = [
            folder.appending(path: ownerFileName),
            folder.appending(path: projectsFolderName).appending(path: "\(projectIdentifier).json"),
            folder.appending(path: outboxFileName),
        ]
        for file in files {
            #expect(try modeOfFile(at: file) == privateFileMode)
            #expect(try isExcludedFromBackup(file) == true)
        }
        #expect(try modeOfFile(at: folder) == privateFolderMode)
        #expect(try modeOfFile(at: folder.appending(path: projectsFolderName)) == privateFolderMode)
    }

    @Test(arguments: invalidIdentifiers)
    func refusesAProjectIdentifierThatIsNotAFileName(identifier: String) throws {
        let escaping = ProjectCache(projectIdentifier: identifier, cursor: 0, tasks: [])
        #expect(throws: SyncStoreError.unwritable) { try store.writeProject(escaping) }
        #expect(try store.readProject(identifier: identifier) == nil)
        try store.eraseProject(identifier: identifier)
        #expect(FileManager.default.fileExists(atPath: folder.path(percentEncoded: false)) == false)
        #expect(try FileManager.default.contentsOfDirectory(atPath: container.path(percentEncoded: false)) == [])
    }

    @Test func throwsUnreadableWhenAFileHoldsBrokenJSON() throws {
        let projectsFolder = folder.appending(path: projectsFolderName)
        try FileManager.default.createDirectory(at: projectsFolder, withIntermediateDirectories: true)
        try Data(brokenJSON.utf8).write(to: folder.appending(path: ownerFileName))
        try Data(brokenJSON.utf8).write(to: projectsFolder.appending(path: "\(projectIdentifier).json"))
        #expect(throws: SyncStoreError.unreadable) { try store.readOwner() }
        #expect(throws: SyncStoreError.unreadable) { try store.readProject(identifier: projectIdentifier) }
    }

    @Test func eraseProjectRemovesOnlyThatProject() throws {
        try store.writeOwner(try ownerCache())
        try store.writeProject(projectCache())
        try store.eraseProject(identifier: projectIdentifier)
        #expect(try store.readProject(identifier: projectIdentifier) == nil)
        #expect(try store.readOwner() == ownerCache())
        try store.eraseProject(identifier: projectIdentifier)
    }

    @Test func eraseRemovesTheFolderAndCanRunTwice() throws {
        try store.writeOwner(try ownerCache())
        try store.writeProject(projectCache())
        try store.erase()
        #expect(FileManager.default.fileExists(atPath: folder.path(percentEncoded: false)) == false)
        try store.erase()
    }

    @Test func writesAThousandTasksWithinTheBudget() throws {
        let cache = projectCache(taskCount: largeTaskCount)
        let clock = ContinuousClock()
        let durations = try (1...timedWriteCount).map { _ in try clock.measure { try store.writeProject(cache) } }
        let median = durations.sorted()[durations.count / 2]
        print("median of \(timedWriteCount) writes of \(largeTaskCount) tasks: \(median)")
        #expect(median < medianBudget)
    }
}
