public struct BoardTask: Sendable, Equatable {
    public let project: Project
    public let task: TaskRecord
    public var workspaceName: String? = nil
}
