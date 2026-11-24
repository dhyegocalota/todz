extension AppModel {
    func cachedOwner() -> OwnerCache? {
        do {
            return try store.readOwner()
        } catch {
            keepInCache { try store.erase() }
            return nil
        }
    }

    func cacheToOpen(for owner: Owner) throws -> OwnerCache? {
        let cached = cachedOwner()
        guard let cached, cached.ownerIdentifier == owner.identifier else {
            forgetWindow()
            outbox = Outbox()
            try store.erase()
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
        guard let workspace = activeWorkspace else { return }
        loadCachedProjects(of: workspace)
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

    func loadCachedProjects(of workspace: Workspace) {
        workspace.projects
            .filter { board.cursor(projectIdentifier: $0.identifier) == nil }
            .forEach { loadCachedProject(identifier: $0.identifier) }
    }

    func keepOwner() {
        guard let ownerIdentifier else { return }
        let cache = OwnerCache(ownerIdentifier: ownerIdentifier, workspaces: workspaces, activeWorkspaceIdentifier: activeWorkspaceIdentifier)
        keepInCache { try store.writeOwner(cache) }
    }

    func keepProject(identifier: String) {
        guard let cursor = board.cursor(projectIdentifier: identifier) else { return }
        let cache = ProjectCache(projectIdentifier: identifier, cursor: cursor, tasks: board.tasks(projectIdentifier: identifier))
        keepInCache { try store.writeProject(cache) }
    }

    func keepInProjectFile(_ task: TaskRecord, projectIdentifier: String) {
        guard let cached = cachedProject(identifier: projectIdentifier) else { return }
        var merged = TaskBoard()
        merged.merge(projectIdentifier: projectIdentifier, tasks: cached.tasks)
        merged.replace(projectIdentifier: projectIdentifier, task: task)
        let cache = ProjectCache(projectIdentifier: projectIdentifier, cursor: cached.cursor, tasks: merged.tasks(projectIdentifier: projectIdentifier))
        keepInCache { try store.writeProject(cache) }
    }

    func forgetProject(identifier: String) {
        board.reset(projectIdentifier: identifier)
        keepInCache { try store.eraseProject(identifier: identifier) }
    }

    func keepOutbox() {
        keepInCache { try store.writeOutbox(OwnerCoding.encoder().encode(outbox)) }
    }

    func forgetCache() {
        outbox = Outbox()
        keepInCache { try store.erase() }
    }

    private func loadCachedProject(identifier: String) {
        guard let cached = cachedProject(identifier: identifier) else { return }
        board.merge(projectIdentifier: identifier, tasks: cached.tasks)
        board = board.setting(cursor: cached.cursor, projectIdentifier: identifier)
        projectLoads[identifier] = .loaded
    }

    private func cachedProject(identifier: String) -> ProjectCache? {
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
            guard !isCacheNotSavedRaised else { return }
            isCacheNotSavedRaised = true
            raise(.cacheNotSaved)
        }
    }
}
