extension AppModel {
    public func switchWorkspace(action: WorkspaceAction) async {
        guard case let .number(number) = action else { return await stepWorkspace(action: action) }
        await switchWorkspace(number: number)
    }

    private func stepWorkspace(action: WorkspaceAction) async {
        guard await isAuthorized(.switchWorkspaces) else { return }
        guard let workspace = WorkspaceShortcuts.workspace(action: action, activeIdentifier: activeWorkspaceIdentifier, in: visibleWorkspaces) else { return }
        await switchWorkspace(identifier: workspace.identifier)
    }
}
