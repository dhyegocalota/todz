import Foundation

private struct QueuedProjectWrite {
    var whole: ProjectCache?
    var keptTasks: [TaskRecord] = []
}

// NB ADR 0027: the window goes on from memory when the cache cannot be written, so a failed write is only told, never retried.
final class ProjectCacheWriter: @unchecked Sendable {
    var onFailure: (@Sendable () -> Void)?
    private let store: any SyncStore
    private let scheduler: CacheScheduler
    private let stateLock = NSLock()
    private let writeLock = NSLock()
    private var queued: [String: QueuedProjectWrite] = [:]
    private var isDrainScheduled = false

    init(store: any SyncStore, scheduler: CacheScheduler) {
        self.store = store
        self.scheduler = scheduler
    }

    func keep(_ cache: ProjectCache) {
        stateLock.withLock { queued[cache.projectIdentifier] = QueuedProjectWrite(whole: cache) }
        scheduleDrain()
    }

    func keep(_ task: TaskRecord, projectIdentifier: String) {
        stateLock.withLock { queued[projectIdentifier, default: QueuedProjectWrite()].keptTasks.append(task) }
        scheduleDrain()
    }

    func discard() {
        stateLock.withLock { queued = [:] }
        writeLock.withLock {}
    }

    func discard(projectIdentifier: String) {
        stateLock.withLock { queued[projectIdentifier] = nil }
        writeLock.withLock {}
    }

    func flush() {
        writeLock.withLock { drainQueue() }
    }

    private func scheduleDrain() {
        let isToSchedule = stateLock.withLock {
            guard !isDrainScheduled else { return false }
            isDrainScheduled = true
            return true
        }
        guard isToSchedule else { return }
        scheduler.run { self.flush() }
    }

    private func drainQueue() {
        while let (identifier, write) = takeNext() {
            keepInStore(identifier: identifier, write: write)
        }
    }

    private func takeNext() -> (String, QueuedProjectWrite)? {
        stateLock.withLock {
            guard let (identifier, write) = queued.first else {
                isDrainScheduled = false
                return nil
            }
            queued[identifier] = nil
            return (identifier, write)
        }
    }

    private func keepInStore(identifier: String, write: QueuedProjectWrite) {
        do {
            guard let cache = try cacheToWrite(identifier: identifier, write: write) else { return }
            try store.writeProject(cache)
        } catch {
            onFailure?()
        }
    }

    private func cacheToWrite(identifier: String, write: QueuedProjectWrite) throws -> ProjectCache? {
        guard let held = try heldCache(identifier: identifier, write: write) else { return nil }
        guard !write.keptTasks.isEmpty else { return held }
        var merged = TaskBoard()
        merged.merge(projectIdentifier: identifier, tasks: held.tasks)
        write.keptTasks.forEach { merged.replace(projectIdentifier: identifier, task: $0) }
        return ProjectCache(projectIdentifier: identifier, cursor: held.cursor, tasks: merged.tasks(projectIdentifier: identifier))
    }

    private func heldCache(identifier: String, write: QueuedProjectWrite) throws -> ProjectCache? {
        guard write.whole == nil else { return write.whole }
        do {
            return try store.readProject(identifier: identifier)
        } catch {
            try store.eraseProject(identifier: identifier)
            return nil
        }
    }
}
