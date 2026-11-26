private let workspaceTagSeparator = " · "

public struct WidgetSnapshotTask: Codable, Equatable, Sendable {
    public let projectIdentifier: String
    public let projectName: String
    public let number: Int?
    public let title: String
    public let dueDate: CalendarDate?
    public let creatorLabel: String?
    public let isOverdue: Bool
    public let state: TaskState
    public let workspaceIdentifier: String?
    public let workspaceName: String?

    public init(
        projectIdentifier: String,
        projectName: String,
        number: Int?,
        title: String,
        dueDate: CalendarDate?,
        creatorLabel: String?,
        isOverdue: Bool,
        state: TaskState,
        workspaceIdentifier: String? = nil,
        workspaceName: String? = nil
    ) {
        self.projectIdentifier = projectIdentifier
        self.projectName = projectName
        self.number = number
        self.title = title
        self.dueDate = dueDate
        self.creatorLabel = creatorLabel
        self.isOverdue = isOverdue
        self.state = state
        self.workspaceIdentifier = workspaceIdentifier
        self.workspaceName = workspaceName
    }

    public var isProjectTagShown: Bool {
        creatorLabel == nil
    }

    static func of(_ boardTask: BoardTask, workspace: Workspace, isWorkspaceTagged: Bool, day: CalendarDate) -> WidgetSnapshotTask {
        let task = boardTask.task
        return WidgetSnapshotTask(
            projectIdentifier: boardTask.project.identifier,
            projectName: taggedName(of: boardTask.project, workspace: workspace, isWorkspaceTagged: isWorkspaceTagged),
            number: task.number,
            title: task.title,
            dueDate: task.dueDate,
            creatorLabel: creatorLabel(of: task.createdBy),
            isOverdue: isOverdue(dueDate: task.dueDate, day: day),
            state: task.state,
            workspaceIdentifier: workspace.identifier,
            workspaceName: workspace.name
        )
    }

    static func of(_ pendingTask: PendingTask, project: Project, workspace: Workspace, isWorkspaceTagged: Bool, day: CalendarDate) -> WidgetSnapshotTask {
        WidgetSnapshotTask(
            projectIdentifier: project.identifier,
            projectName: taggedName(of: project, workspace: workspace, isWorkspaceTagged: isWorkspaceTagged),
            number: nil,
            title: pendingTask.title,
            dueDate: pendingTask.dueDate,
            creatorLabel: nil,
            isOverdue: isOverdue(dueDate: pendingTask.dueDate, day: day),
            state: .open,
            workspaceIdentifier: workspace.identifier,
            workspaceName: workspace.name
        )
    }

    func setting(state: TaskState) -> WidgetSnapshotTask {
        WidgetSnapshotTask(
            projectIdentifier: projectIdentifier,
            projectName: projectName,
            number: number,
            title: title,
            dueDate: dueDate,
            creatorLabel: creatorLabel,
            isOverdue: isOverdue,
            state: state,
            workspaceIdentifier: workspaceIdentifier,
            workspaceName: workspaceName
        )
    }

    private static func taggedName(of project: Project, workspace: Workspace, isWorkspaceTagged: Bool) -> String {
        guard isWorkspaceTagged else { return project.name }
        return [workspace.name, project.name].joined(separator: workspaceTagSeparator)
    }

    private static func creatorLabel(of creator: ChangeActor) -> String? {
        switch creator {
        case .owner: nil
        case let .agent(clientName): clientName
        }
    }

    private static func isOverdue(dueDate: CalendarDate?, day: CalendarDate) -> Bool {
        guard let dueDate else { return false }
        return dueDate < day
    }
}
