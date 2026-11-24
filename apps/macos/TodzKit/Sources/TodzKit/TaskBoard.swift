public struct TaskBoard: Sendable, Equatable {
    public init() {}

    public func tasks(projectIdentifier: String) -> [TaskRecord] {
        fatalError("TaskBoard is not implemented")
    }

    public func task(projectIdentifier: String, number: Int) -> TaskRecord? {
        fatalError("TaskBoard is not implemented")
    }

    public mutating func merge(projectIdentifier: String, tasks: [TaskRecord]) {
        fatalError("TaskBoard is not implemented")
    }

    public mutating func replace(projectIdentifier: String, task: TaskRecord) {
        fatalError("TaskBoard is not implemented")
    }

    public mutating func reset(projectIdentifier: String) {
        fatalError("TaskBoard is not implemented")
    }
}
