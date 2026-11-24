public struct AddTaskDestination: Hashable, Sendable {
    public let projectIdentifier: String
    public let dueDate: CalendarDate?

    public var target: WriteTarget {
        .newTask(projectIdentifier: projectIdentifier)
    }
}
