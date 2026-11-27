private let fewestWorkspacesToTag = 2

public struct MenuBarRowMeta: Equatable, Sendable {
    public let overdue: CalendarDate?
    public let projectName: String?
    public let workspaceName: String?
    public let agentName: String?

    public init(task: BoardTask, today: CalendarDate, shownWorkspaceCount: Int) {
        let dueDate = task.task.dueDate
        let isOverdue = dueDate.map { $0 < today } ?? false
        overdue = isOverdue ? dueDate : nil
        projectName = task.project.isInbox ? nil : task.project.name
        workspaceName = shownWorkspaceCount >= fewestWorkspacesToTag ? task.workspaceName : nil
        agentName = Self.agentName(of: task)
    }

    public var hasSubline: Bool {
        overdue != nil || projectName != nil || workspaceName != nil
    }

    public var isEmpty: Bool {
        !hasSubline && agentName == nil
    }

    private static func agentName(of task: BoardTask) -> String? {
        guard case let .agent(clientName) = task.task.createdBy else { return nil }
        return clientName
    }
}
