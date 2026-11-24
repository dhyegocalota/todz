extension AppModel {
    public func createWorkspace(name: String) async {
        let created = await write(target: .newWorkspace, retry: { await self.createWorkspace(name: name) }) {
            try await service.createWorkspace(session: $0, name: name)
        }
        guard let created else { return }
        workspaces.append(created)
        selectedItem = .inbox
        phase = .ready
        await activate(created)
    }

    public func switchWorkspace(identifier: String) async {
        guard let workspace = workspaces.first(where: { $0.identifier == identifier }) else { return }
        await activate(workspace)
    }

    public func refresh() async {
        guard let activeWorkspace else { return }
        await pull(projectIdentifiers: activeWorkspace.projects.map(\.identifier))
    }

    public func createProject(name: String) async {
        guard let workspace = activeWorkspace else { return }
        let created = await write(target: .newProject, retry: { await self.createProject(name: name) }) {
            try await service.createProject(session: $0, workspaceIdentifier: workspace.identifier, name: name)
        }
        guard let created else { return }
        replaceProjects(workspaceIdentifier: workspace.identifier) { $0 + [created] }
        projectLoads[created.identifier] = .loaded
        selectedItem = .project(identifier: created.identifier)
    }

    public func renameProject(projectIdentifier: String, name: String) async {
        guard let workspace = activeWorkspace else { return }
        let target = WriteTarget.projectName(projectIdentifier: projectIdentifier)
        let renamed = await write(target: target, retry: { await self.renameProject(projectIdentifier: projectIdentifier, name: name) }) {
            try await service.renameProject(session: $0, projectIdentifier: projectIdentifier, name: name)
        }
        guard let renamed else { return }
        replaceProjects(workspaceIdentifier: workspace.identifier) { projects in
            projects.map { $0.identifier == renamed.identifier ? renamed : $0 }
        }
    }

    func loadWorkspaces() async {
        let listed: [Workspace]
        do {
            listed = try await request { try await service.listWorkspaces(session: $0) }
        } catch {
            raiseLoadFailure(error, retry: { await self.loadWorkspaces() })
            return
        }
        workspaces = listed
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
        keepSelection(in: workspace)
        await pull(projectIdentifiers: workspace.projects.map(\.identifier))
    }

    private func forgetActiveWorkspace() {
        board = TaskBoard()
        projectLoads = [:]
        histories = [:]
        selectedTask = nil
    }

    private func keepSelection(in workspace: Workspace) {
        guard case let .project(identifier) = selectedItem else { return }
        let isInWorkspace = workspace.projects.contains { $0.identifier == identifier }
        guard !isInWorkspace else { return }
        selectedItem = .inbox
    }

    private func pull(projectIdentifiers: [String]) async {
        guard let session, let workspaceIdentifier = activeWorkspaceIdentifier else { return }
        pullsInFlight.formUnion(projectIdentifiers)
        defer { pullsInFlight.subtract(projectIdentifiers) }
        let feed = ProjectFeed(service: service)
        do {
            try await withThrowingTaskGroup(of: ProjectPull.self) { group in
                projectIdentifiers.forEach { projectIdentifier in
                    group.addTask { try await ProjectPull.pulling(feed: feed, session: session, projectIdentifier: projectIdentifier) }
                }
                for try await pulled in group {
                    record(pulled, session: session, workspaceIdentifier: workspaceIdentifier)
                }
            }
        } catch {
            guard self.session == session else { return }
            endSession()
            return
        }
        raisePullFailures(projectIdentifiers: projectIdentifiers)
    }

    private func record(_ pulled: ProjectPull, session: String, workspaceIdentifier: String) {
        let isCurrentPull = self.session == session && activeWorkspaceIdentifier == workspaceIdentifier
        guard isCurrentPull else { return }
        switch pulled {
        case let .loaded(projectIdentifier, tasks):
            board.merge(projectIdentifier: projectIdentifier, tasks: tasks)
            projectLoads[projectIdentifier] = .loaded
        case let .failed(projectIdentifier):
            projectLoads[projectIdentifier] = .failed
        }
    }

    private func raisePullFailures(projectIdentifiers: [String]) {
        let failedIdentifiers = projectIdentifiers.filter { projectLoads[$0] == .failed }
        guard !failedIdentifiers.isEmpty else { return }
        raise(.someProjectsFailed, retry: { await self.pull(projectIdentifiers: failedIdentifiers) })
    }

    private func replaceProjects(workspaceIdentifier: String, change: ([Project]) -> [Project]) {
        workspaces = workspaces.map { workspace in
            guard workspace.identifier == workspaceIdentifier else { return workspace }
            return Workspace(identifier: workspace.identifier, name: workspace.name, createdAt: workspace.createdAt, projects: change(workspace.projects))
        }
    }
}
