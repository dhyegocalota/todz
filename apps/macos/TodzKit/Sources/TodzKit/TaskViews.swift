import Foundation

private typealias DatedTask = (dueDate: CalendarDate, positioned: PositionedTask)
private typealias FinishedTask = (completedAt: Date, positioned: PositionedTask)
private typealias DayEntry = (day: CalendarDate, task: BoardTask)

private func isEarlierDue(_ lhs: DatedTask, _ rhs: DatedTask) -> Bool {
    guard lhs.dueDate == rhs.dueDate else { return lhs.dueDate < rhs.dueDate }
    return PositionedTask.isEarlierInSidebarOrder(lhs.positioned, rhs.positioned)
}

private func isNewerCompletion(_ lhs: FinishedTask, _ rhs: FinishedTask) -> Bool {
    guard lhs.completedAt == rhs.completedAt else { return lhs.completedAt > rhs.completedAt }
    return PositionedTask.isEarlierInSidebarByNumber(lhs.positioned, rhs.positioned)
}

public struct TaskViews: Sendable {
    private let projects: [Project]
    private let board: TaskBoard
    private let day: CalendarDate
    private let timeZone: TimeZone

    public init(projects: [Project], board: TaskBoard, day: CalendarDate, timeZone: TimeZone) {
        self.projects = projects
        self.board = board
        self.day = day
        self.timeZone = timeZone
    }

    public var inbox: [BoardTask] {
        guard let inboxProject = projects.first(where: \.isInbox) else { return [] }
        return project(identifier: inboxProject.identifier)
    }

    public func project(identifier: String) -> [BoardTask] {
        openTasks
            .filter { $0.boardTask.project.identifier == identifier }
            .sorted(by: PositionedTask.isEarlierInManualOrder)
            .map(\.boardTask)
    }

    public var today: TodayTasks {
        let doneToday = finishedTasks.filter { CalendarDate.today(in: timeZone, at: $0.completedAt) == day }
        return TodayTasks(open: openTasksDue { $0 <= day }, doneToday: doneToday.map(\.positioned.boardTask))
    }

    public var upcoming: [BoardTask] {
        openTasksDue { $0 > day }
    }

    public var done: [BoardTask] {
        finishedTasks.map(\.positioned.boardTask)
    }

    public var upcomingDays: [TaskDay] {
        groupedByDay(datedOpenTasks { $0 > day }.map { (day: $0.dueDate, task: $0.positioned.boardTask) })
    }

    public var doneDays: [TaskDay] {
        groupedByDay(finishedTasks.map { (day: CalendarDate.today(in: timeZone, at: $0.completedAt), task: $0.positioned.boardTask) })
    }

    private var positionedTasks: [PositionedTask] {
        projects.enumerated().flatMap { position, project in
            board.tasks(projectIdentifier: project.identifier).map { task in
                PositionedTask(position: position, boardTask: BoardTask(project: project, task: task))
            }
        }
    }

    private var openTasks: [PositionedTask] {
        positionedTasks.filter { $0.task.state == .open }
    }

    private var finishedTasks: [FinishedTask] {
        positionedTasks
            .filter { $0.task.state == .done }
            .compactMap { positioned in positioned.task.completedAt.map { (completedAt: $0, positioned: positioned) } }
            .sorted(by: isNewerCompletion)
    }

    private func openTasksDue(within isInWindow: (CalendarDate) -> Bool) -> [BoardTask] {
        datedOpenTasks(within: isInWindow).map(\.positioned.boardTask)
    }

    private func datedOpenTasks(within isInWindow: (CalendarDate) -> Bool) -> [DatedTask] {
        openTasks
            .compactMap { positioned in positioned.task.dueDate.map { (dueDate: $0, positioned: positioned) } }
            .filter { isInWindow($0.dueDate) }
            .sorted(by: isEarlierDue)
    }

    private func groupedByDay(_ entries: [DayEntry]) -> [TaskDay] {
        entries.reduce(into: []) { days, entry in
            guard let last = days.last, last.day == entry.day else {
                days.append(TaskDay(day: entry.day, tasks: [entry.task]))
                return
            }
            days[days.count - 1] = TaskDay(day: last.day, tasks: last.tasks + [entry.task])
        }
    }
}
