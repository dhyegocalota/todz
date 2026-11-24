extension AppModel {
    @discardableResult
    public func createWorkspace(name: String) async -> Workspace? {
        let created = await write(target: .newWorkspace, retry: { await self.createWorkspace(name: name) }) {
            try await service.createWorkspace(session: $0, name: name)
        }
        guard let created else { return nil }
        workspaces.append(created)
        selectedItem = .inbox
        phase = .ready
        await activate(created)
        return created
    }

    public func switchWorkspace(identifier: String) async {
        guard let workspace = workspaces.first(where: { $0.identifier == identifier }) else { return }
        await activate(workspace)
    }

    public func loadFailure(of workspace: Workspace) -> AppBanner? {
        let loads = workspace.projects.map { projectLoads[$0.identifier] }
        let isNothingLoaded = loads.allSatisfy { $0 == .unreachable || $0 == .failed }
        guard isNothingLoaded else { return nil }
        let isServerUnreachable = loads.allSatisfy { $0 == .unreachable }
        return isServerUnreachable ? .network : .someProjectsFailed
    }

    @discardableResult
    public func createProject(name: String) async -> Project? {
        guard let workspace = activeWorkspace else { return nil }
        let created = await write(target: .newProject, retry: { await self.createProject(name: name) }) {
            try await service.createProject(session: $0, workspaceIdentifier: workspace.identifier, name: name)
        }
        guard let created else { return nil }
        replaceProjects(workspaceIdentifier: workspace.identifier) { projects in
            let isAlreadyListed = projects.contains { $0.identifier == created.identifier }
            return isAlreadyListed ? projects : projects + [created]
        }
        guard activeWorkspaceIdentifier == workspace.identifier else { return created }
        projectLoads[created.identifier] = .loaded
        selectedItem = .project(identifier: created.identifier)
        followActiveProjects()
        return created
    }

    @discardableResult
    public func renameProject(projectIdentifier: String, name: String) async -> Project? {
        guard let workspace = activeWorkspace else { return nil }
        let target = WriteTarget.projectName(projectIdentifier: projectIdentifier)
        let renamed = await write(target: target, retry: { await self.renameProject(projectIdentifier: projectIdentifier, name: name) }) {
            try await service.renameProject(session: $0, projectIdentifier: projectIdentifier, name: name)
        }
        guard let renamed else { return nil }
        replaceProjects(workspaceIdentifier: workspace.identifier) { projects in
            projects.map { $0.identifier == renamed.identifier ? renamed : $0 }
        }
        return renamed
    }

    func loadWorkspaces() async {
        do {
            try await openListedWorkspaces()
        } catch {
            raiseLoadFailure(error, retry: { await self.loadWorkspaces() })
        }
    }

    func reloadWorkspacesQuietly() async {
        do {
            try await openListedWorkspaces()
        } catch {
            isWorkspaceListOutdated = true
        }
    }

    private func openListedWorkspaces() async throws {
        let listed = try await request { try await service.listWorkspaces(session: $0) }
        isWorkspaceListOutdated = false
        workspaces = listed
        keepOwner()
        startSending()
        guard let workspace = preferredWorkspace else {
            phase = .naming
            return
        }
        phase = .ready
        await activate(workspace)
    }

    private var preferredWorkspace: Workspace? {
        guard let activeWorkspace else { return workspaces.first }
        return activeWorkspace
    }

    private func activate(_ workspace: Workspace) async {
        let isAnotherWorkspace = workspace.identifier != activeWorkspaceIdentifier
        if isAnotherWorkspace { forgetActiveWorkspace() }
        activeWorkspaceIdentifier = workspace.identifier
        keepOwner()
        keepSelection(in: workspace)
        loadCachedProjects(of: workspace)
        followActiveProjects()
        await pull(projectIdentifiers: workspace.projects.map(\.identifier), workspaceIdentifier: workspace.identifier)
    }

    private func forgetActiveWorkspace() {
        guard activeWorkspaceIdentifier != nil else { return }
        stopWatching()
        board = TaskBoard()
        projectLoads = [:]
        histories = [:]
        unconfirmedDrafts = [:]
        unsavedNotes = [:]
        selectedTask = nil
        dismissBanner()
    }

    private func keepSelection(in workspace: Workspace) {
        guard case let .project(identifier) = selectedItem else { return }
        let isInWorkspace = workspace.projects.contains { $0.identifier == identifier }
        guard !isInWorkspace else { return }
        selectedItem = .inbox
    }

    func isShown(projectIdentifier: String) -> Bool {
        guard let activeWorkspace else { return false }
        return activeWorkspace.projects.contains { $0.identifier == projectIdentifier }
    }

    private func replaceProjects(workspaceIdentifier: String, change: ([Project]) -> [Project]) {
        workspaces = workspaces.map { workspace in
            guard workspace.identifier == workspaceIdentifier else { return workspace }
            return Workspace(identifier: workspace.identifier, name: workspace.name, createdAt: workspace.createdAt, projects: change(workspace.projects))
        }
        keepOwner()
    }
}
