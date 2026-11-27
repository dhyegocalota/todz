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
    public let rows: [WorkspaceChromeRow]
    public let showsSwitchHint: Bool
    public let lastShortcutNumber: Int
    public let canStep: Bool

    public init(visible: [Workspace], selection: WorkspaceSelection?, isMainWindow: Bool) {
        switcher = .menu
        showsAllWorkspaces = true
        rows = []
        showsSwitchHint = true
        lastShortcutNumber = 0
        canStep = true
    }
}
