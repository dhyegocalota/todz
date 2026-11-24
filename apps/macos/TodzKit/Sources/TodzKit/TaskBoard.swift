public struct TaskBoard: Sendable, Equatable {
    private var tasksOfProject: [String: [Int: TaskRecord]] = [:]

    public init() {}

    public func tasks(projectIdentifier: String) -> [TaskRecord] {
        guard let held = tasksOfProject[projectIdentifier] else { return [] }
        return held.values.sorted { $0.number < $1.number }
    }

    public func task(projectIdentifier: String, number: Int) -> TaskRecord? {
        tasksOfProject[projectIdentifier]?[number]
    }

    public mutating func merge(projectIdentifier: String, tasks: [TaskRecord]) {
        tasks.forEach { replace(projectIdentifier: projectIdentifier, task: $0) }
    }

    public mutating func replace(projectIdentifier: String, task: TaskRecord) {
        guard !isOlderThanTheHeldCopy(task, projectIdentifier: projectIdentifier) else { return }
        tasksOfProject[projectIdentifier, default: [:]][task.number] = task
    }

    private func isOlderThanTheHeldCopy(_ task: TaskRecord, projectIdentifier: String) -> Bool {
        guard let held = tasksOfProject[projectIdentifier]?[task.number] else { return false }
        return task.updatedAt < held.updatedAt
    }

    public mutating func reset(projectIdentifier: String) {
        tasksOfProject[projectIdentifier] = nil
    }

    public func cursor(projectIdentifier: String) -> Int? {
        fatalError("TaskBoard.cursor is not implemented")
    }

    public func setting(cursor: Int, projectIdentifier: String) -> TaskBoard {
        fatalError("TaskBoard.setting is not implemented")
    }

    public func applying(_ outbox: Outbox) -> TaskBoard {
        fatalError("TaskBoard.applying is not implemented")
    }
}
