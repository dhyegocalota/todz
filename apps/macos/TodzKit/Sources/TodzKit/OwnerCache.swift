public struct OwnerCache: Codable, Sendable, Equatable {
    public let ownerIdentifier: String
    public let workspaces: [Workspace]
    public let activeWorkspaceIdentifier: String?
    private let storedSelection: WorkspaceSelection?

    enum CodingKeys: String, CodingKey {
        case ownerIdentifier
        case workspaces
        case activeWorkspaceIdentifier
        case storedSelection = "selection"
    }

    public init(ownerIdentifier: String, workspaces: [Workspace], activeWorkspaceIdentifier: String?, selection: WorkspaceSelection? = nil) {
        self.ownerIdentifier = ownerIdentifier
        self.workspaces = workspaces
        self.activeWorkspaceIdentifier = activeWorkspaceIdentifier
        self.storedSelection = selection
    }

    public var selection: WorkspaceSelection? {
        if let storedSelection { return storedSelection }
        return activeWorkspaceIdentifier.map { .chosen([$0]) }
    }
}
