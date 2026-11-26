public enum WorkspaceSelection: Codable, Equatable, Sendable {
    case all
    case chosen(Set<String>)

    public func workspaces(in workspaces: [Workspace]) -> [Workspace] {
        []
    }

    public func toggling(identifier: String, in workspaces: [Workspace]) -> WorkspaceSelection {
        self
    }
}
