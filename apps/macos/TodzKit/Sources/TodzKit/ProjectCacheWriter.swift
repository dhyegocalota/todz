final class ProjectCacheWriter: @unchecked Sendable {
    var onFailure: (@Sendable () -> Void)?

    init(store: any SyncStore, scheduler: CacheScheduler) {}

    func keep(_ cache: ProjectCache) {}

    func keep(_ task: TaskRecord, projectIdentifier: String) {}

    func discard() {}

    func discard(projectIdentifier: String) {}

    func flush() {}
}
