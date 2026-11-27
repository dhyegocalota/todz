public enum PresentedWorkspace: Equatable, Sendable {
    case visible(Workspace)
    case locked(identifier: String)

    public var identifier: String {
        switch self {
        case let .visible(workspace): workspace.identifier
        case let .locked(identifier): identifier
        }
    }
}
