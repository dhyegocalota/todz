extension AppModel {
    // NB ADR 0128: a locked session keeps the set that was selected when it locked, and nothing outside it exists for any surface.
    public var visibleWorkspaces: [Workspace] {
        workspaceLock.visible(workspaces, kept: keptWorkspaceIdentifiers)
    }

    var keptWorkspaceIdentifiers: Set<String> {
        Set(selectedWorkspaces.map(\.identifier))
    }

    public func beginWorkspaceSwitch() async -> Bool {
        await isAuthorized(.switchWorkspaces)
    }

    func isShowable(_ selection: WorkspaceSelection) -> Bool {
        let selected = selection.workspaces(in: workspaces)
        let isOpenEndedWhileLocked = selection == .all && workspaceLock.isLocked
        return !selected.isEmpty && !isOpenEndedWhileLocked && selected.allSatisfy { visibleWorkspaces.contains($0) }
    }

    // NB ADR 0128: a locked session asks the Mac owner before showing any workspace outside its kept set; an unlocked one shows several.
    func isShowableAfterAsking(_ selection: WorkspaceSelection) async -> Bool {
        guard !isShowable(selection) else { return true }
        let isSelectingKnownWorkspaces = !selection.workspaces(in: workspaces).isEmpty
        let isAskingFromALockedSession = workspaceLock.isLocked && isSelectingKnownWorkspaces
        guard isAskingFromALockedSession else { return false }
        guard await isAuthorized(.switchWorkspaces) else { return false }
        return isShowable(selection)
    }

    public func hiddenWorkspaceAction(for chord: KeyChord) -> WorkspaceAction? {
        guard workspaceLock.isLocked, phase == .ready else { return nil }
        return WorkspaceAction.all.first { action in
            guard case let .number(number) = action, number > visibleWorkspaces.count else { return false }
            return action.inAppChord == chord || action.listChord == chord
        }
    }

    public func isLocked(workspaceIdentifier: String) -> Bool {
        workspaceLock.isLocked(workspaceIdentifier: workspaceIdentifier, kept: keptWorkspaceIdentifiers)
    }

    func isInLockedWorkspace(projectIdentifier: String) -> Bool {
        let owner = workspaces.first { workspace in workspace.projects.contains { $0.identifier == projectIdentifier } }
        guard let owner else { return false }
        return isLocked(workspaceIdentifier: owner.identifier)
    }

    func refuseAsLocked() {
        raise(.workspaceGone)
    }

    func isAuthorized(_ action: WorkspaceLockAction) async -> Bool {
        await workspaceLock.authorize(action)
    }

    func pinnedWhileLocked(_ selection: WorkspaceSelection) -> WorkspaceSelection {
        guard workspaceLock.isLocked else { return selection }
        return selection.pinned(to: workspaces)
    }

    public func prepareWidgetsForTermination() {
        publishedWidgetSnapshot = nil
        publishWidgets()
        reloadWidgets()
    }

    public func turnWorkspaceLockOn() async {
        workspaceLock.turnOn()
        await lockToSelectedWorkspaces()
    }

    public func turnWorkspaceLockOff() async -> Bool {
        await workspaceLock.turnOff()
    }

    public func setWorkspaceLockTimeout(_ timeout: WorkspaceLockTimeout) async -> Bool {
        await workspaceLock.set(timeout: timeout)
    }

    public func noteWorkspaceLockInput() {
        guard workspaceLock.noteInput() else { return }
        workspaceRelock = Task { await lockToSelectedWorkspaces() }
    }

    public func relockWorkspaces(because trigger: RelockTrigger) async {
        guard workspaceLock.relock(because: trigger) else { return }
        await lockToSelectedWorkspaces()
    }

    public func relockWorkspacesIfIdle() async {
        guard workspaceLock.relockIfIdle() else { return }
        await lockToSelectedWorkspaces()
    }

    // NB ADR 0128: a relock keeps the selected set, pins All to the workspaces it held, erases every other workspace from the cache and rewrites the shared snapshot.
    func lockToSelectedWorkspaces() async {
        selection = selection.map(pinnedWhileLocked)
        keepOwner()
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
