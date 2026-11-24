import Foundation
import Testing
@testable import TodzKit

private let snapshotFileName = "widget-snapshot.json"
private let requestsFolderName = "requests"
private let privateFileMode = 0o600
private let privateFolderMode = 0o700
private let brokenJSON = "{"
private let requestsPerPass = 50
private let manyRequestCount = 60
private let snapshotMaxByteCount = 1_048_576
private let requestMaxByteCount = 4_096
private let padding = UInt8(ascii: " ")
private let today = CalendarDate(year: 2026, month: 11, day: 24)
private let namesThatAreNotRequests = ["../\(snapshotFileName)", snapshotFileName, "", "a/b.json"]

private func temporaryFolder() -> URL {
    FileManager.default.temporaryDirectory.appending(path: "todz-widgets-\(UUID().uuidString)").appending(path: "Group")
}

private func modeOfFile(at url: URL) throws -> Int {
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path(percentEncoded: false))
    return try #require(attributes[.posixPermissions] as? Int)
}

private func exists(_ url: URL) -> Bool {
    FileManager.default.fileExists(atPath: url.path(percentEncoded: false))
}

private func padded(_ data: Data, beyond maxByteCount: Int) -> Data {
    data + Data(repeating: padding, count: maxByteCount + 1 - data.count)
}

private func request(_ number: Int, state: TaskState = .done) -> WidgetRequest {
    WidgetRequest(projectIdentifier: "acme-inbox", number: number, state: state, at: fixedInstant.addingTimeInterval(TimeInterval(number)))
}

private let snapshot = WidgetSnapshot(
    workspaceName: "Acme",
    day: today,
    timeZoneIdentifier: harnessTimeZoneIdentifier,
    open: [
        WidgetSnapshotTask(
            projectIdentifier: "acme-inbox",
            projectName: "Inbox",
            number: 1,
            title: "Write the tests",
            dueDate: today,
            creatorLabel: "Claude Code",
            isOverdue: false,
            state: .open
        )
    ],
    pending: [],
    doneToday: []
)

@Suite final class FileWidgetStoreTests {
    let folder = temporaryFolder()

    var container: URL {
        folder.deletingLastPathComponent()
    }

    var store: FileWidgetStore {
        FileWidgetStore(folder: folder)
    }

    var requestsFolder: URL {
        folder.appending(path: requestsFolderName)
    }

    deinit {
        try? FileManager.default.removeItem(at: container)
    }

    @Test func answersNothingWhenNothingWasWritten() throws {
        #expect(try store.readSnapshot() == nil)
        #expect(try store.requests() == [])
    }

    @Test func readsBackTheSnapshotItWrote() throws {
        try store.writeSnapshot(snapshot)
        #expect(try store.readSnapshot() == snapshot)
    }

    @Test func readsTwoRequestsInTheOrderTheyWereAdded() throws {
        try store.addRequest(request(1))
        try store.addRequest(request(2, state: .open))
        #expect(try store.requests().map(\.request) == [request(1), request(2, state: .open)])
    }

    @Test func removesExactlyTheRequestsReadAndKeepsOneAddedSince() throws {
        try store.addRequest(request(1))
        try store.addRequest(request(2))
        let read = try store.requests()
        try store.addRequest(request(3))
        try store.removeRequests(read.map(\.name))
        #expect(try store.requests().map(\.request) == [request(3)])
    }

    @Test func keepsEveryFilePrivate() throws {
        try store.writeSnapshot(snapshot)
        try store.addRequest(request(1))
        let requestName = try #require(try store.requests().first?.name)
        #expect(try modeOfFile(at: folder.appending(path: snapshotFileName)) == privateFileMode)
        #expect(try modeOfFile(at: requestsFolder.appending(path: requestName)) == privateFileMode)
        #expect(try modeOfFile(at: requestsFolder) == privateFolderMode)
    }

    @Test func refusesASymlinkedSnapshot() throws {
        let elsewhere = container.appending(path: "Elsewhere")
        try FileWidgetStore(folder: elsewhere).writeSnapshot(snapshot)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try FileManager.default.createSymbolicLink(at: folder.appending(path: snapshotFileName), withDestinationURL: elsewhere.appending(path: snapshotFileName))
        #expect(throws: WidgetStoreError.unreadable) { try store.readSnapshot() }
    }

    @Test func throwsUnreadableForABrokenSnapshot() throws {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try Data(brokenJSON.utf8).write(to: folder.appending(path: snapshotFileName))
        #expect(throws: WidgetStoreError.unreadable) { try store.readSnapshot() }
    }

    @Test func refusesASnapshotLargerThanItsCap() throws {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let encoded = try OwnerCoding.encoder().encode(snapshot)
        try padded(encoded, beyond: snapshotMaxByteCount).write(to: folder.appending(path: snapshotFileName))
        #expect(throws: WidgetStoreError.unreadable) { try store.readSnapshot() }
    }

    @Test func removesARequestLargerThanItsCapAndReadsTheOthers() throws {
        try store.addRequest(request(1))
        try store.addRequest(request(2))
        let oversized = try #require(try store.requests().first?.name)
        let encoded = try OwnerCoding.encoder().encode(request(1))
        try padded(encoded, beyond: requestMaxByteCount).write(to: requestsFolder.appending(path: oversized))
        #expect(try store.requests().map(\.request) == [request(2)])
        #expect(exists(requestsFolder.appending(path: oversized)) == false)
    }

    @Test func removesAnUnreadableRequestAloneAndReadsTheOthers() throws {
        try store.addRequest(request(1))
        try store.addRequest(request(2))
        let broken = try #require(try store.requests().first?.name)
        try Data(brokenJSON.utf8).write(to: requestsFolder.appending(path: broken))
        #expect(try store.requests().map(\.request) == [request(2)])
        #expect(exists(requestsFolder.appending(path: broken)) == false)
    }

    @Test func removesASymlinkedRequestAndLeavesItsTarget() throws {
        let target = container.appending(path: "target.json")
        try FileManager.default.createDirectory(at: container, withIntermediateDirectories: true)
        try OwnerCoding.encoder().encode(request(9)).write(to: target)
        try store.addRequest(request(1))
        let link = requestsFolder.appending(path: "\(UUID().uuidString).json")
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: target)
        #expect(try store.requests().map(\.request) == [request(1)])
        #expect(exists(link) == false)
        #expect(exists(target))
    }

    @Test func readsAtMostFiftyRequestsAPassOldestFirst() throws {
        try (1...manyRequestCount).forEach { try store.addRequest(request($0)) }
        let firstPass = try store.requests()
        #expect(firstPass.map(\.request) == (1...requestsPerPass).map { request($0) })
        try store.removeRequests(firstPass.map(\.name))
        #expect(try store.requests().map(\.request) == ((requestsPerPass + 1)...manyRequestCount).map { request($0) })
    }

    @Test(arguments: namesThatAreNotRequests)
    func removesNothingNamedOutsideTheRequests(name: String) throws {
        try store.writeSnapshot(snapshot)
        try store.addRequest(request(1))
        try store.removeRequests([name])
        #expect(try store.readSnapshot() == snapshot)
        #expect(try store.requests().count == 1)
    }

    @Test func erasingTheSnapshotKeepsTheRequests() throws {
        try store.writeSnapshot(snapshot)
        try store.addRequest(request(1))
        try store.eraseSnapshot()
        try store.eraseSnapshot()
        #expect(try store.readSnapshot() == nil)
        #expect(try store.requests().map(\.request) == [request(1)])
    }

    @Test func eraseRemovesTheSnapshotAndTheRequestsKeepsTheFolderAndCanRunTwice() throws {
        try store.writeSnapshot(snapshot)
        try store.addRequest(request(1))
        try store.erase()
        #expect(try store.readSnapshot() == nil)
        #expect(try store.requests() == [])
        #expect(exists(folder))
        try store.erase()
    }
}
