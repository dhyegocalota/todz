import Foundation
import Testing
@testable import TodzKit

private let projectIdentifier = "launch"

private func page(numbers: [Int], cursor: Int, hasMore: Bool) -> Result<ChangePage, OwnerAPIError> {
    .success(ChangePage(tasks: numbers.map { MutableTask(number: $0).record }, cursor: cursor, hasMore: hasMore))
}

@MainActor @Suite struct ProjectFeedTests {
    let service = FakeOwnerService()
    let session = UUID().uuidString

    @Test func readsPagesUntilNothingIsLeft() async throws {
        service.changeScripts[projectIdentifier] = [
            page(numbers: [1, 2], cursor: 4, hasMore: true),
            page(numbers: [3], cursor: 7, hasMore: true),
            page(numbers: [], cursor: 7, hasMore: false),
        ]
        let tasks = try await ProjectFeed(service: service).pull(session: session, projectIdentifier: projectIdentifier, cursor: 0)
        #expect(tasks.map(\.number) == [1, 2, 3])
        #expect(service.calls.compactMap(\.cursor) == [0, 4, 7])
        #expect(service.calls.allSatisfy { $0.projectIdentifier == projectIdentifier })
    }

    @Test func aSinglePageEndsThePull() async throws {
        service.changeScripts[projectIdentifier] = [page(numbers: [1], cursor: 1, hasMore: false)]
        let tasks = try await ProjectFeed(service: service).pull(session: session, projectIdentifier: projectIdentifier, cursor: 0)
        #expect(tasks.map(\.number) == [1])
        #expect(service.calls == [.readChanges(session: session, projectIdentifier: projectIdentifier, cursor: 0)])
    }

    @Test func restartsOnceFromZeroWhenTheCursorIsAhead() async throws {
        service.changeScripts[projectIdentifier] = [
            .failure(.cursorAhead),
            page(numbers: [1], cursor: 1, hasMore: true),
            page(numbers: [2], cursor: 2, hasMore: false),
        ]
        let tasks = try await ProjectFeed(service: service).pull(session: session, projectIdentifier: projectIdentifier, cursor: 9)
        #expect(tasks.map(\.number) == [1, 2])
        #expect(service.calls.compactMap(\.cursor) == [9, 0, 1])
    }

    @Test func aSecondCursorAheadThrows() async throws {
        service.changeScripts[projectIdentifier] = [.failure(.cursorAhead), .failure(.cursorAhead), page(numbers: [1], cursor: 1, hasMore: false)]
        await #expect(throws: OwnerAPIError.cursorAhead) {
            try await ProjectFeed(service: service).pull(session: session, projectIdentifier: projectIdentifier, cursor: 9)
        }
        #expect(service.calls.compactMap(\.cursor) == [9, 0])
    }

    @Test func anyOtherFailureEndsThePull() async throws {
        service.changeScripts[projectIdentifier] = [page(numbers: [1], cursor: 1, hasMore: true), .failure(.unreachable)]
        await #expect(throws: OwnerAPIError.unreachable) {
            try await ProjectFeed(service: service).pull(session: session, projectIdentifier: projectIdentifier, cursor: 0)
        }
        #expect(service.calls.compactMap(\.cursor) == [0, 1])
    }

    @Test func aCancelledPullStartsNoRequest() async throws {
        let feed = ProjectFeed(service: service)
        let pull = Task { try await feed.pull(session: session, projectIdentifier: projectIdentifier, cursor: 0) }
        pull.cancel()
        await #expect(throws: CancellationError.self) { try await pull.value }
        #expect(service.calls == [])
    }
}
