public enum WorkspaceLockAction: Hashable, Sendable {
    case showWorkspaces(identifiers: Set<String>)
    case createWorkspace
    case removeWorkspace
    case turnOff
    case changeTimeout
}
