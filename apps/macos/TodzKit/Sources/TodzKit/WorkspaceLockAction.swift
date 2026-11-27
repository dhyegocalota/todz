public enum WorkspaceLockAction: Hashable, Sendable {
    case switchWorkspaces
    case createWorkspace
    case removeWorkspace
    case turnOff
    case changeTimeout
}
