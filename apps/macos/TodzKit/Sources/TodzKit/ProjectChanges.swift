public struct ProjectChanges: Sendable, Equatable {
    public let tasks: [TaskRecord]
    public let deletedNumbers: [Int]
    public let cursor: Int
    public let isFromStart: Bool
}
