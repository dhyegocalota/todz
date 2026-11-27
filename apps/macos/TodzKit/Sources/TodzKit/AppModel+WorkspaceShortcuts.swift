extension AppModel {
    public func switchWorkspace(action: WorkspaceAction) async {
        guard await isAuthorized(.switchWorkspaces) else { return }
        guard let workspace = WorkspaceShortcuts.workspace(action: action, activeIdentifier: activeWorkspaceIdentifier, in: visibleWorkspaces) else { return }
        await switchWorkspace(identifier: workspace.identifier)
    }
}
