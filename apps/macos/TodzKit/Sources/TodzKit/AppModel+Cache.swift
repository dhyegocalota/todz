extension AppModel {
    func cachedOwner() -> OwnerCache? {
        try? store.readOwner()
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

    func keepOutbox() {
        keepInCache { try store.writeOutbox(OwnerCoding.encoder().encode(outbox)) }
    }

    func forgetCache() {
        outbox = Outbox()
        keepInCache { try store.erase() }
    }

    private func loadCachedProject(identifier: String) {
        guard let cached = try? store.readProject(identifier: identifier) else { return }
        board.merge(projectIdentifier: identifier, tasks: cached.tasks)
        board = board.setting(cursor: cached.cursor, projectIdentifier: identifier)
        projectLoads[identifier] = .loaded
    }

    private func keepInCache(_ write: () throws -> Void) {
        try? write()
    }
}
