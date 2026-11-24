public struct WidgetSnapshotTask: Codable, Equatable, Sendable {
    public let projectIdentifier: String
    public let projectName: String
    public let number: Int?
    public let title: String
    public let dueDate: CalendarDate?
    public let creatorLabel: String?
    public let isOverdue: Bool
    public let state: TaskState

    public init(
        projectIdentifier: String,
        projectName: String,
        number: Int?,
        title: String,
        dueDate: CalendarDate?,
        creatorLabel: String?,
        isOverdue: Bool,
        state: TaskState
    ) {
        self.projectIdentifier = projectIdentifier
        self.projectName = projectName
        self.number = number
        self.title = title
        self.dueDate = dueDate
        self.creatorLabel = creatorLabel
        self.isOverdue = isOverdue
        self.state = state
    }

    public var isProjectTagShown: Bool {
        creatorLabel == nil
    }

    static func of(_ boardTask: BoardTask, day: CalendarDate) -> WidgetSnapshotTask {
        let task = boardTask.task
        return WidgetSnapshotTask(
            projectIdentifier: boardTask.project.identifier,
            projectName: boardTask.project.name,
            number: task.number,
            title: task.title,
            dueDate: task.dueDate,
            creatorLabel: creatorLabel(of: task.createdBy),
            isOverdue: isOverdue(dueDate: task.dueDate, day: day),
            state: task.state
        )
    }

    static func of(_ pendingTask: PendingTask, project: Project, day: CalendarDate) -> WidgetSnapshotTask {
        WidgetSnapshotTask(
            projectIdentifier: project.identifier,
            projectName: project.name,
            number: nil,
            title: pendingTask.title,
            dueDate: pendingTask.dueDate,
            creatorLabel: nil,
            isOverdue: isOverdue(dueDate: pendingTask.dueDate, day: day),
            state: .open
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
            state: state
        )
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
