import Foundation
import Testing
@testable import TodzKit

private let launchIdentifier = "acme-launch"
private let inboxIdentifier = "acme-inbox"

private func cache(project identifier: String, cursor: Int, titles: [String] = []) -> ProjectCache {
    let tasks = titles.enumerated().map { MutableTask(number: $0.offset + 1, title: $0.element).record }
    return ProjectCache(projectIdentifier: identifier, cursor: cursor, tasks: tasks)
}

private func writer(store: InMemorySyncStore, drains: HeldCacheDrains) -> ProjectCacheWriter {
    ProjectCacheWriter(store: store, scheduler: drains.scheduler)
}

@Suite struct ProjectCacheWriterTests {
    @Test func writesQueuedForTwoProjectsEachEndWithThatProjectsLastValue() async {
        let store = InMemorySyncStore()
        let drains = HeldCacheDrains()
        let writer = writer(store: store, drains: drains)
        writer.keep(cache(project: inboxIdentifier, cursor: 1))
        writer.keep(cache(project: launchIdentifier, cursor: 1))
        writer.keep(cache(project: inboxIdentifier, cursor: 2))
        #expect(store.routes() == [])
        await drains.runOffTheMainThread()
        #expect(store.projects[inboxIdentifier]?.cursor == 2)
        #expect(store.projects[launchIdentifier]?.cursor == 1)
        #expect(store.routes().filter { $0 == .writeProject }.count == 2)
    }

    @Test func aBurstSchedulesOneDrain() {
        let store = InMemorySyncStore()
        let drains = HeldCacheDrains()
        let writer = writer(store: store, drains: drains)
        (1...5).forEach { writer.keep(cache(project: inboxIdentifier, cursor: $0)) }
        #expect(drains.count == 1)
    }

    @Test func aWriteAfterTheDrainSchedulesTheNextDrain() async {
        let store = InMemorySyncStore()
        let drains = HeldCacheDrains()
        let writer = writer(store: store, drains: drains)
        writer.keep(cache(project: inboxIdentifier, cursor: 1))
        await drains.runOffTheMainThread()
        writer.keep(cache(project: inboxIdentifier, cursor: 2))
        #expect(drains.count == 1)
        await drains.runOffTheMainThread()
        #expect(store.projects[inboxIdentifier]?.cursor == 2)
    }

    @Test func discardDropsWhatIsQueued() async {
        let store = InMemorySyncStore()
        let drains = HeldCacheDrains()
        let writer = writer(store: store, drains: drains)
        writer.keep(cache(project: inboxIdentifier, cursor: 1))
        writer.keep(cache(project: launchIdentifier, cursor: 1))
        writer.discard()
        await drains.runOffTheMainThread()
        #expect(store.routes() == [])
    }

    @Test func discardOfOneProjectDropsOnlyThatProject() async {
        let store = InMemorySyncStore()
        let drains = HeldCacheDrains()
        let writer = writer(store: store, drains: drains)
        writer.keep(cache(project: inboxIdentifier, cursor: 1))
        writer.keep(cache(project: launchIdentifier, cursor: 1))
        writer.discard(projectIdentifier: launchIdentifier)
        await drains.runOffTheMainThread()
        #expect(store.projects.keys.sorted() == [inboxIdentifier])
    }

    @Test func flushWritesWhatIsQueuedOnTheCallingThread() {
        let store = InMemorySyncStore()
        let drains = HeldCacheDrains()
        let writer = writer(store: store, drains: drains)
        writer.keep(cache(project: inboxIdentifier, cursor: 3))
        writer.flush()
        #expect(store.projects[inboxIdentifier]?.cursor == 3)
    }

    @Test func tasksKeptInAFileMergeIntoWhatTheFileHoldsOnce() async {
        let store = InMemorySyncStore()
        store.projects[launchIdentifier] = cache(project: launchIdentifier, cursor: 4, titles: ["One", "Two"])
        let drains = HeldCacheDrains()
        let writer = writer(store: store, drains: drains)
        writer.keep(MutableTask(number: 2, title: "Two renamed", updatedAt: fixedInstant.addingTimeInterval(60)).record, projectIdentifier: launchIdentifier)
        writer.keep(MutableTask(number: 3, title: "Three").record, projectIdentifier: launchIdentifier)
        await drains.runOffTheMainThread()
        #expect(store.projects[launchIdentifier]?.cursor == 4)
        #expect(store.projects[launchIdentifier]?.tasks.map(\.title) == ["One", "Two renamed", "Three"])
        #expect(store.routes().filter { $0 == .writeProject }.count == 1)
    }

    @Test func aFullWriteQueuedAfterTasksKeptInTheFileWins() async {
        let store = InMemorySyncStore()
        store.projects[launchIdentifier] = cache(project: launchIdentifier, cursor: 4, titles: ["One"])
        let drains = HeldCacheDrains()
        let writer = writer(store: store, drains: drains)
        writer.keep(MutableTask(number: 9, title: "Kept").record, projectIdentifier: launchIdentifier)
        writer.keep(cache(project: launchIdentifier, cursor: 7, titles: ["Whole"]))
        await drains.runOffTheMainThread()
        #expect(store.projects[launchIdentifier]?.tasks.map(\.title) == ["Whole"])
    }

    @Test func aFailedWriteIsToldToTheFailureHandler() async {
        let store = InMemorySyncStore()
        store.failures[.writeProject] = .unwritable
        let drains = HeldCacheDrains()
        let writer = writer(store: store, drains: drains)
        let failures = FailureCount()
        writer.onFailure = { failures.increment() }
        writer.keep(cache(project: inboxIdentifier, cursor: 1))
        await drains.runOffTheMainThread()
        #expect(failures.value == 1)
    }
}

private final class FailureCount: @unchecked Sendable {
    private let lock = NSLock()
    private var count = 0

    var value: Int {
        lock.withLock { count }
    }

    func increment() {
        lock.withLock { count += 1 }
    }
}
