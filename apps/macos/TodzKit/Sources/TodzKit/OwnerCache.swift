public struct OwnerCache: Codable, Sendable, Equatable {
    public let ownerIdentifier: String
    public let workspaces: [Workspace]
    public let activeWorkspaceIdentifier: String?
}
