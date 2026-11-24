extension AppModel {
    public func addTaskDestination(for item: SidebarItem) -> AddTaskDestination? {
        guard let inbox = activeWorkspace?.projects.first(where: \.isInbox) else { return nil }
        switch item {
        case .inbox: return AddTaskDestination(projectIdentifier: inbox.identifier, dueDate: nil)
        case .today: return AddTaskDestination(projectIdentifier: inbox.identifier, dueDate: today)
        case let .project(identifier): return AddTaskDestination(projectIdentifier: identifier, dueDate: nil)
        case .upcoming, .done: return nil
        }
    }

    public func reveal(task key: TaskKey) {
        fatalError("reveal(task:) is not implemented")
    }
}
