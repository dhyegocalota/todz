extension AppModel {
    @discardableResult
    public func createWorkspace(name: String) async -> Workspace? {
        let isFirstWorkspace = workspaces.isEmpty
        let isAuthorizedToCreate = isFirstWorkspace ? true : await isAuthorized(.createWorkspace)
        guard isAuthorizedToCreate else { return nil }
        let created = await write(target: .newWorkspace, retry: { await self.createWorkspace(name: name) }) {
            try await service.createWorkspace(session: $0, name: name)
        }
        guard let created else { return nil }
        workspaces.append(created)
        selectedItem = .inbox
        phase = .ready
        await show(selection == .all ? .all : .chosen([created.identifier]))
        return created
    }

    public func switchWorkspace(identifier: String) async {
        guard workspaces.contains(where: { $0.identifier == identifier }) else { return }
        await selectWorkspaces(.chosen([identifier]))
    }

    public func selectWorkspaces(_ selection: WorkspaceSelection) async {
        guard phase == .ready else { return }
        guard selection != self.selection else { return }
        guard isShowable(selection) else { return }
        await show(selection)
    }

    public func toggleWorkspace(identifier: String) async {
        guard let selection else { return }
        await selectWorkspaces(selection.toggling(identifier: identifier, in: workspaces))
    }

    public func chooseWorkspace(identifier: String) async {
        await chooseWorkspaces(.chosen([identifier]))
    }

    public func chooseWorkspaces(_ selection: WorkspaceSelection) async {
        guard phase == .choosing else { return }
        guard isShowable(selection) else { return }
        phase = .ready
        await show(selection)
    }

    public func switchWorkspace(number: Int) async {
        guard let workspace = WorkspaceShortcuts.workspace(number: number, in: visibleWorkspaces) else { return }
        await switchWorkspace(identifier: workspace.identifier)
    }

    func isFirstLoad(of workspace: Workspace) -> Bool {
        isFirstLoad(of: [workspace])
    }

    func isFirstLoad(of workspaces: [Workspace]) -> Bool {
        workspaces.contains { workspace in workspace.projects.contains { projectLoads[$0.identifier] == nil } }
    }

    public func loadFailure(of workspace: Workspace) -> AppBanner? {
        loadFailure(of: [workspace])
    }

    public func loadFailure(of workspaces: [Workspace]) -> AppBanner? {
        let loads = workspaces.flatMap(\.projects).map { projectLoads[$0.identifier] }
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
        guard !isInLockedWorkspace(projectIdentifier: projectIdentifier) else { refuseAsLocked(); return nil }
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

    @discardableResult
    public func renameWorkspace(identifier: String, name: String) async -> Workspace? {
        guard !isLocked(workspaceIdentifier: identifier) else { refuseAsLocked(); return nil }
        let target = WriteTarget.workspaceName(workspaceIdentifier: identifier)
        let renamed = await write(target: target, retry: { await self.renameWorkspace(identifier: identifier, name: name) }) {
            try await service.renameWorkspace(session: $0, workspaceIdentifier: identifier, name: name)
        }
        guard let renamed else { return nil }
        workspaces = workspaces.map { $0.identifier == renamed.identifier ? renamed : $0 }
        keepOwner()
        return renamed
    }

    public func deleteWorkspace(identifier: String) async {
        guard await isAuthorized(.removeWorkspace) else { return }
        let target = WriteTarget.workspaceRemoval(workspaceIdentifier: identifier)
        let wasShown = shownWorkspaces.contains { $0.identifier == identifier }
        let isDeleted = await write(target: target, retry: { await self.deleteWorkspace(identifier: identifier) }) { session in
            try await deletionIsDone { try await service.deleteWorkspace(session: session, workspaceIdentifier: identifier) }
        }
        guard isDeleted != nil else { return }
        workspaces = workspaces.filter { $0.identifier != identifier }
        keepOwner()
        await reloadWorkspacesQuietly()
        let isShownWorkspaceMissing = wasShown && activeWorkspace == nil
        guard isShownWorkspaceMissing else { return }
        guard let first = workspaces.first else {
            forgetActiveWorkspace()
            phase = .naming
            return
        }
        phase = .ready
        guard let selectionToShow else { return await show(.chosen([first.identifier])) }
        await show(selectionToShow)
    }

    public func deleteProject(projectIdentifier: String) async {
        guard !isInLockedWorkspace(projectIdentifier: projectIdentifier) else { refuseAsLocked(); return }
        let target = WriteTarget.projectRemoval(projectIdentifier: projectIdentifier)
        let isDeleted = await write(target: target, retry: { await self.deleteProject(projectIdentifier: projectIdentifier) }) { session in
            try await deletionIsDone { try await service.deleteProject(session: session, projectIdentifier: projectIdentifier) }
        }
        guard isDeleted != nil else { return }
        workspaces.forEach { workspace in
            replaceProjects(workspaceIdentifier: workspace.identifier) { projects in projects.filter { $0.identifier != projectIdentifier } }
        }
        followActiveProjects()
        await reloadWorkspacesQuietly()
    }

    private func deletionIsDone(_ deletion: () async throws -> Void) async throws -> Bool {
        do {
            try await deletion()
        } catch OwnerAPIError.notFound {}
        return true
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
            guard phase == .loading else { return }
            raiseLoadFailure(error, retry: { await self.loadWorkspaces() })
        }
    }

    private func openListedWorkspaces() async throws {
        workspaceListingsInFlight += 1
        defer {
            workspaceListingsInFlight -= 1
            retryOwnerConfirmation()
        }
        try await confirmOwner()
        let listed = try await request { try await service.listWorkspaces(session: $0) }
        isWorkspaceListOutdated = !isOwnerConfirmed
        workspaces = listed
        keepOwner()
        startSending()
        guard let selectionToShow else {
            forgetActiveWorkspace()
            phase = workspaces.isEmpty ? .naming : .choosing
            return
        }
        phase = .ready
        await show(selectionToShow)
    }

    private var selectionToShow: WorkspaceSelection? {
        let isCurrentGone = activeWorkspaceIdentifier.map { current in !workspaces.contains { $0.identifier == current } } == true
        if workspaceLock.isLocked, isCurrentGone { return nil }
        if let selection, !selection.workspaces(in: workspaces).isEmpty { return collapsedWhileLocked(selection.limited(to: workspaces)) }
        guard workspaces.count == 1, let sole = workspaces.first else { return nil }
        return .chosen([sole.identifier])
    }

    func primary(of shown: [Workspace]) -> Workspace? {
        if let active = shown.first(where: { $0.identifier == activeWorkspaceIdentifier }) { return active }
        return shown.first
    }

    // NB ADR 0080: the primary workspace takes writes that name no project; every shown workspace is pulled and watched.
    private func show(_ newSelection: WorkspaceSelection) async {
        let shown = newSelection.workspaces(in: workspaces)
        guard let primary = primary(of: shown) else { return }
        let previousIdentifiers = Set(selectedWorkspaces.flatMap(\.projects).map(\.identifier))
        let shownIdentifiers = shown.flatMap(\.projects).map(\.identifier)
        let isAnotherSet = shown.map(\.identifier) != selectedWorkspaces.map(\.identifier)
        let isIncremental = isAnotherSet && !previousIdentifiers.isEmpty
        if isAnotherSet && !isIncremental { forgetActiveWorkspace() }
        if isIncremental { release(projectIdentifiers: previousIdentifiers.subtracting(shownIdentifiers)) }
        selection = newSelection
        activeWorkspaceIdentifier = primary.identifier
        keepOwner()
        keepSelection(in: shown)
        loadCachedProjects(of: shown)
        followActiveProjects()
        let joinedIdentifiers = shownIdentifiers.filter { !previousIdentifiers.contains($0) }
        await pull(projectIdentifiers: isIncremental ? joinedIdentifiers : shownIdentifiers, workspaceIdentifier: primary.identifier)
    }

    private func release(projectIdentifiers: Set<String>) {
        projectIdentifiers.forEach { projectIdentifier in
            watches.removeValue(forKey: projectIdentifier)?.cancel()
            watchAttempts[projectIdentifier] = nil
            isWatchAnswered[projectIdentifier] = nil
            board.reset(projectIdentifier: projectIdentifier)
            board = board.clearingCursor(projectIdentifier: projectIdentifier)
            projectLoads[projectIdentifier] = nil
        }
        histories = histories.filter { !projectIdentifiers.contains($0.key.projectIdentifier) }
        unsavedNotes = unsavedNotes.filter { !projectIdentifiers.contains($0.key.projectIdentifier) }
        forgetKeys()
        selectedTask = nil
        dismissBanner()
    }

    private func forgetActiveWorkspace() {
        guard activeWorkspaceIdentifier != nil else { return }
        stopWatching()
        forgetKeys()
        board = TaskBoard()
        projectLoads = [:]
        histories = [:]
        unsavedNotes = [:]
        selectedTask = nil
        dismissBanner()
    }

    private func keepSelection(in shown: [Workspace]) {
        let isKeyScreenForgotten = selectedItem == .connectAgent && keyProjectIdentifier == nil
        if isKeyScreenForgotten { showInboxKeys() }
        guard case let .project(identifier) = selectedItem else { return }
        let isInWorkspace = shown.contains { workspace in workspace.projects.contains { $0.identifier == identifier } }
        guard !isInWorkspace else { return }
        selectedItem = .inbox
    }

    func isShown(projectIdentifier: String) -> Bool {
        shownProjects.contains { $0.identifier == projectIdentifier }
    }

    private func replaceProjects(workspaceIdentifier: String, change: ([Project]) -> [Project]) {
        workspaces = workspaces.map { workspace in
            guard workspace.identifier == workspaceIdentifier else { return workspace }
            return Workspace(identifier: workspace.identifier, name: workspace.name, createdAt: workspace.createdAt, projects: change(workspace.projects))
        }
        keepOwner()
    }
}
