// NB ADR 0113: every switching surface draws from the visible list alone, so a locked session draws what an account holding only its kept set draws.
public enum WorkspaceSwitcherStyle: Equatable, Sendable {
    case plainName
    case menu
}

public struct WorkspaceChromeRow: Equatable, Sendable {
    public let workspace: Workspace
    public let isChecked: Bool
}

public struct WorkspaceChrome: Equatable, Sendable {
    public let switcher: WorkspaceSwitcherStyle
    public let showsAllWorkspaces: Bool
    public let showsAlongside: Bool
    public let rows: [WorkspaceChromeRow]

    public init(visible: [Workspace], selection: WorkspaceSelection?, isMainWindow: Bool) {
        let hasSeveral = visible.count > 1
        let checked = selection?.workspaces(in: visible)
        switcher = isMainWindow || hasSeveral ? .menu : .plainName
        showsAllWorkspaces = hasSeveral
        showsAlongside = hasSeveral
        rows = visible.map { WorkspaceChromeRow(workspace: $0, isChecked: checked?.contains($0) == true) }
    }
}
