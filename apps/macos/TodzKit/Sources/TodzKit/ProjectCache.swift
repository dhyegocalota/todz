public struct ProjectCache: Codable, Sendable, Equatable {
    public let projectIdentifier: String
    public let cursor: Int
    public let tasks: [TaskRecord]
}
