// NB ADR 0080: "All" is its own case, so a workspace created later joins it; a chosen set never grows by itself.
public enum WorkspaceSelection: Codable, Equatable, Sendable {
    case all
    case chosen(Set<String>)

    public func workspaces(in workspaces: [Workspace]) -> [Workspace] {
        switch self {
        case .all: workspaces
        case let .chosen(identifiers): workspaces.filter { identifiers.contains($0.identifier) }
        }
    }

    func limited(to workspaces: [Workspace]) -> WorkspaceSelection {
        guard case let .chosen(identifiers) = self else { return self }
        return .chosen(identifiers.intersection(workspaces.map(\.identifier)))
    }

    public func toggling(identifier: String, in workspaces: [Workspace]) -> WorkspaceSelection {
        let shownIdentifiers = Set(self.workspaces(in: workspaces).map(\.identifier))
        let toggled = shownIdentifiers.symmetricDifference([identifier])
        guard !toggled.isEmpty else { return self }
        return .chosen(toggled)
    }
}
