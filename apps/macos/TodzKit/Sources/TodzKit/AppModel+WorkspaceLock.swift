extension AppModel {
    public var presentedWorkspaces: [PresentedWorkspace] {
        workspaceLock.presented(workspaces, current: activeWorkspaceIdentifier)
    }

    public var visibleWorkspaces: [Workspace] {
        []
    }

    public func beginWorkspaceSwitch() async -> Bool {
        false
    }

    public func isLocked(workspaceIdentifier: String) -> Bool {
        workspaceLock.isLocked(workspaceIdentifier: workspaceIdentifier, current: activeWorkspaceIdentifier)
    }

    func isInLockedWorkspace(projectIdentifier: String) -> Bool {
        let owner = workspaces.first { workspace in workspace.projects.contains { $0.identifier == projectIdentifier } }
        guard let owner else { return false }
        return isLocked(workspaceIdentifier: owner.identifier)
    }

    func refuseAsLocked() {
        raise(.workspaceLocked)
    }

    func isAuthorized(_ action: WorkspaceLockAction) async -> Bool {
        await workspaceLock.authorize(action, current: activeWorkspaceIdentifier)
    }

    func isAuthorized(toShow selection: WorkspaceSelection) async -> Bool {
        let identifiers = Set(selection.workspaces(in: workspaces).map(\.identifier))
        guard !identifiers.isEmpty else { return false }
        return await isAuthorized(.showWorkspaces(identifiers: identifiers))
    }

    func collapsedWhileLocked(_ selection: WorkspaceSelection) -> WorkspaceSelection? {
        guard workspaceLock.isLocked else { return selection }
        let selected = selection.workspaces(in: workspaces)
        guard let shown = workspaceLock.visible(selected, current: activeWorkspaceIdentifier).first else { return nil }
        return .chosen([shown.identifier])
    }

    var widgetWorkspaces: [Workspace] {
        workspaceLock.visibleToWidgets(shownWorkspaces, current: activeWorkspaceIdentifier)
    }

    public func prepareWidgetsForTermination() {
        publishedWidgetSnapshot = nil
        publishWidgets()
        reloadWidgets()
    }

    public func unlockWorkspaces() async -> Bool {
        await isAuthorized(toShow: .all)
    }

    public func turnWorkspaceLockOn() async {
        workspaceLock.turnOn()
        await lockToCurrentWorkspace()
    }

    public func turnWorkspaceLockOff() async -> Bool {
        await workspaceLock.turnOff(current: activeWorkspaceIdentifier)
    }

    public func setWorkspaceLockTimeout(_ timeout: WorkspaceLockTimeout) async -> Bool {
        await workspaceLock.set(timeout: timeout, current: activeWorkspaceIdentifier)
    }

    public func noteWorkspaceLockInput() {
        guard workspaceLock.noteInput() else { return }
        workspaceRelock = Task { await lockToCurrentWorkspace() }
    }

    public func relockWorkspaces(because trigger: RelockTrigger) async {
        guard workspaceLock.relock(because: trigger) else { return }
        await lockToCurrentWorkspace()
    }

    public func relockWorkspacesIfIdle() async {
        guard workspaceLock.relockIfIdle() else { return }
        await lockToCurrentWorkspace()
    }

    // NB ADR 0110: a relock releases every other workspace from memory and the cache and rewrites the shared snapshot from the current one alone.
    func lockToCurrentWorkspace() async {
        if phase == .ready, let current = activeWorkspaceIdentifier { await selectWorkspaces(.chosen([current])) }
        forgetLockedWorkspaces()
        publishedWidgetSnapshot = nil
        publishWidgets()
    }

    func forgetLockedWorkspaces() {
        workspaces
            .filter { isLocked(workspaceIdentifier: $0.identifier) }
            .flatMap(\.projects)
            .forEach { forgetProject(identifier: $0.identifier) }
    }
}
