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

    public func refresh() async {
        guard let activeWorkspace else { return }
        await pull(projectIdentifiers: activeWorkspace.projects.map(\.identifier), workspaceIdentifier: activeWorkspace.identifier)
    }

    public func loadFailure(of workspace: Workspace) -> AppBanner? {
        fatalError("AppModel.loadFailure is not implemented")
    }

    @discardableResult
    public func createProject(name: String) async -> Project? {
        guard let workspace = activeWorkspace else { return nil }
        let created = await write(target: .newProject, retry: { await self.createProject(name: name) }) {
            try await service.createProject(session: $0, workspaceIdentifier: workspace.identifier, name: name)
        }
        guard let created else { return nil }
        replaceProjects(workspaceIdentifier: workspace.identifier) { $0 + [created] }
        guard activeWorkspaceIdentifier == workspace.identifier else { return created }
        projectLoads[created.identifier] = .loaded
        selectedItem = .project(identifier: created.identifier)
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
        await pull(projectIdentifiers: workspace.projects.map(\.identifier), workspaceIdentifier: workspace.identifier)
    }

    private func forgetActiveWorkspace() {
        guard activeWorkspaceIdentifier != nil else { return }
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

    private func pull(projectIdentifiers: [String], workspaceIdentifier: String) async {
        guard let session, activeWorkspaceIdentifier == workspaceIdentifier else { return }
        startPulls(projectIdentifiers: projectIdentifiers)
        defer { endPulls(projectIdentifiers: projectIdentifiers) }
        let feed = ProjectFeed(service: service)
        let pulls: [ProjectPull]
        do {
            pulls = try await withThrowingTaskGroup(of: ProjectPull.self) { group in
                projectIdentifiers.forEach { projectIdentifier in
                    group.addTask { try await ProjectPull.pulling(feed: feed, session: session, projectIdentifier: projectIdentifier) }
                }
                var pulls: [ProjectPull] = []
                for try await pulled in group {
                    record(pulled, session: session, workspaceIdentifier: workspaceIdentifier)
                    pulls.append(pulled)
                }
                return pulls
            }
        } catch {
            guard self.session == session else { return }
            endSession()
            return
        }
        guard isCurrent(session: session, workspaceIdentifier: workspaceIdentifier) else { return }
        raiseFailures(of: pulls, workspaceIdentifier: workspaceIdentifier)
    }

    private func isCurrent(session: String, workspaceIdentifier: String) -> Bool {
        self.session == session && activeWorkspaceIdentifier == workspaceIdentifier
    }

    private func startPulls(projectIdentifiers: [String]) {
        projectIdentifiers.forEach { pullsInFlight[$0, default: 0] += 1 }
    }

    private func endPulls(projectIdentifiers: [String]) {
        projectIdentifiers.forEach { projectIdentifier in
            guard let count = pullsInFlight[projectIdentifier] else { return }
            let isLastPull = count == 1
            pullsInFlight[projectIdentifier] = isLastPull ? nil : count - 1
        }
    }

    private func record(_ pulled: ProjectPull, session: String, workspaceIdentifier: String) {
        guard isCurrent(session: session, workspaceIdentifier: workspaceIdentifier) else { return }
        switch pulled {
        case let .loaded(projectIdentifier, tasks):
            board.merge(projectIdentifier: projectIdentifier, tasks: tasks)
            projectLoads[projectIdentifier] = .loaded
        case let .unreachable(projectIdentifier), let .failed(projectIdentifier):
            guard projectLoads[projectIdentifier] != .loaded else { return }
            projectLoads[projectIdentifier] = .failed
        }
    }

    private func raiseFailures(of pulls: [ProjectPull], workspaceIdentifier: String) {
        let failedIdentifiers = pulls.compactMap(\.failedProjectIdentifier)
        guard !failedIdentifiers.isEmpty else { return }
        let isServerUnreachable = pulls.allSatisfy(\.isUnreachable)
        let banner: AppBanner = isServerUnreachable ? .network : .someProjectsFailed
        raise(banner, retry: { await self.pull(projectIdentifiers: failedIdentifiers, workspaceIdentifier: workspaceIdentifier) })
    }

    private func replaceProjects(workspaceIdentifier: String, change: ([Project]) -> [Project]) {
        workspaces = workspaces.map { workspace in
            guard workspace.identifier == workspaceIdentifier else { return workspace }
            return Workspace(identifier: workspace.identifier, name: workspace.name, createdAt: workspace.createdAt, projects: change(workspace.projects))
        }
    }
}
