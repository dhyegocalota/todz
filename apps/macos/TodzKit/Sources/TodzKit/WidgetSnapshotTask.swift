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
}
