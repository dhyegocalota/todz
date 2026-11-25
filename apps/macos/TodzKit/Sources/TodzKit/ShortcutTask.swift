public struct ShortcutTask: Equatable, Sendable {
    public let key: TaskKey
    public let title: String
    public let projectName: String

    static func of(_ boardTask: BoardTask) -> ShortcutTask {
        ShortcutTask(
            key: TaskKey(projectIdentifier: boardTask.project.identifier, number: boardTask.task.number),
            title: boardTask.task.title,
            projectName: boardTask.project.name
        )
    }
}
