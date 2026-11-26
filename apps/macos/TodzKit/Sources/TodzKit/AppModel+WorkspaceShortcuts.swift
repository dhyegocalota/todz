extension AppModel {
    public func switchWorkspace(action: WorkspaceAction) async {
        guard let workspace = WorkspaceShortcuts.workspace(action: action, activeIdentifier: activeWorkspaceIdentifier, in: workspaces) else { return }
        await switchWorkspace(identifier: workspace.identifier)
    }
}
