import Foundation

extension AppModel {
    func cachedOwner() -> OwnerCache? {
        do {
            return try store.readOwner()
        } catch {
            keepInCache { try eraseCache() }
            return nil
        }
    }

    func cacheToOpen(for owner: Owner) throws -> OwnerCache? {
        let cached = cachedOwner()
        guard let cached, cached.ownerIdentifier == owner.identifier else {
            forgetWindow()
            outbox = Outbox()
            try eraseCache()
            eraseWidgets()
            return nil
        }
        return cached
    }

    func openCache(_ cached: OwnerCache?) {
        loadOutbox()
        guard let cached else { return }
        ownerIdentifier = cached.ownerIdentifier
        workspaces = cached.workspaces
        activeWorkspaceIdentifier = cached.activeWorkspaceIdentifier
        selection = cached.selection
        guard let primary = primary(of: shownWorkspaces) else { return }
        activeWorkspaceIdentifier = primary.identifier
        selection = selection.flatMap(collapsedWhileLocked)
        forgetLockedWorkspaces()
        loadCachedProjects(of: shownWorkspaces)
        phase = .ready
        followActiveProjects()
    }

    func loadOutbox() {
        do {
            guard let data = try store.readOutbox() else { return }
            outbox = try OwnerCoding.decoder().decode(Outbox.self, from: data)
        } catch {
            outbox = Outbox()
            keepOutbox()
            raise(.waitingChangesLost)
        }
    }

    func loadCachedProjects(of shown: [Workspace]) {
        shown.flatMap(\.projects)
            .filter { board.cursor(projectIdentifier: $0.identifier) == nil }
            .forEach { loadCachedProject(identifier: $0.identifier) }
    }

    // NB ADR 0027: nothing listed or pulled is written to the cache before this session's owner is confirmed.
    func keepOwner() {
        guard isOwnerConfirmed, let ownerIdentifier else { return }
        let cache = OwnerCache(
            ownerIdentifier: ownerIdentifier,
            workspaces: workspaces,
            activeWorkspaceIdentifier: activeWorkspaceIdentifier,
            selection: selectionToStore
        )
        keepInCache { try store.writeOwner(cache) }
    }

    private var selectionToStore: WorkspaceSelection? {
        let isSingleActiveWorkspace = activeWorkspaceIdentifier.map { selection == .chosen([$0]) } == true
        guard !isSingleActiveWorkspace else { return nil }
        return selection
    }

    func keepProject(identifier: String) {
        guard isOwnerConfirmed, let cursor = board.cursor(projectIdentifier: identifier) else { return }
        cacheWriter.keep(ProjectCache(projectIdentifier: identifier, cursor: cursor, tasks: board.tasks(projectIdentifier: identifier)))
    }

    func keepInProjectFile(_ task: TaskRecord, projectIdentifier: String) {
        cacheWriter.keep(task, projectIdentifier: projectIdentifier)
    }

    func forgetProject(identifier: String) {
        board.reset(projectIdentifier: identifier)
        projectLoads[identifier] = nil
        cacheWriter.discard(projectIdentifier: identifier)
        keepInCache { try store.eraseProject(identifier: identifier) }
    }

    func eraseCache() throws {
        cacheWriter.discard()
        try store.erase()
    }

    func keepOutbox() {
        keepInCache { try store.writeOutbox(OwnerCoding.encoder().encode(outbox)) }
    }

    func forgetCache() throws {
        forgetWindow()
        outbox = Outbox()
        phase = .loading
        try eraseCache()
        eraseWidgets()
    }

    private func loadCachedProject(identifier: String) {
        guard let cached = cachedProject(identifier: identifier) else { return }
        board.merge(projectIdentifier: identifier, tasks: cached.tasks)
        board = board.setting(cursor: cached.cursor, projectIdentifier: identifier)
        projectLoads[identifier] = .loaded
    }

    private func cachedProject(identifier: String) -> ProjectCache? {
        cacheWriter.flush()
        do {
            return try store.readProject(identifier: identifier)
        } catch {
            keepInCache { try store.eraseProject(identifier: identifier) }
            return nil
        }
    }

    // NB ADR 0027: the window goes on from memory when the cache cannot be written, and says so once per launch.
    private func keepInCache(_ write: () throws -> Void) {
        do {
            try write()
        } catch {
            noteCacheNotSaved()
        }
    }

    nonisolated func noteCacheNotSavedFromAnyThread() {
        guard Thread.isMainThread else {
            Task { @MainActor [weak self] in self?.noteCacheNotSaved() }
            return
        }
        MainActor.assumeIsolated { noteCacheNotSaved() }
    }

    private func noteCacheNotSaved() {
        guard !isCacheNotSavedRaised else { return }
        isCacheNotSavedRaised = true
        raise(.cacheNotSaved)
    }
}
