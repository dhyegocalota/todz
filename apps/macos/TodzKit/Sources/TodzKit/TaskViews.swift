import Foundation

private typealias DatedTask = (dueDate: CalendarDate, positioned: PositionedTask)
private typealias FinishedTask = (completedAt: Date, positioned: PositionedTask)
private typealias DayEntry = (day: CalendarDate, task: BoardTask)
private typealias DayRun = (day: CalendarDate, tasks: [BoardTask])

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
    private let pendingTasks: [PendingTask]
    private let day: CalendarDate
    private let timeZone: TimeZone

    public init(projects: [Project], board: TaskBoard, pendingTasks: [PendingTask] = [], day: CalendarDate, timeZone: TimeZone) {
        self.projects = projects
        self.board = board
        self.pendingTasks = pendingTasks
        self.day = day
        self.timeZone = timeZone
    }

    public func pendingTasks(for item: SidebarItem) -> [PendingTask] {
        switch item {
        case .inbox:
            guard let inboxProject else { return [] }
            return workspacePendingTasks.filter { $0.projectIdentifier == inboxProject.identifier }
        case let .project(identifier):
            return workspacePendingTasks.filter { $0.projectIdentifier == identifier }
        case .today:
            return pendingTasksDue { $0 <= day }
        case .upcoming, .done, .connectAgent:
            return []
        }
    }

    public var upcomingPendingDays: [PendingTaskDay] {
        let dueLater = pendingTasksDue { $0 > day }
        return Set(dueLater.compactMap(\.dueDate)).sorted().map { dueDay in
            PendingTaskDay(day: dueDay, tasks: dueLater.filter { $0.dueDate == dueDay })
        }
    }

    public var inbox: [BoardTask] {
        guard let inboxProject else { return [] }
        return project(identifier: inboxProject.identifier)
    }

    private var inboxProject: Project? {
        projects.first(where: \.isInbox)
    }

    private var workspacePendingTasks: [PendingTask] {
        let projectIdentifiers = Set(projects.map(\.identifier))
        return pendingTasks.filter { projectIdentifiers.contains($0.projectIdentifier) }
    }

    private func pendingTasksDue(within isInWindow: (CalendarDate) -> Bool) -> [PendingTask] {
        workspacePendingTasks.filter { pendingTask in
            guard let dueDate = pendingTask.dueDate else { return false }
            return isInWindow(dueDate)
        }
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
        let runs = entries.reduce(into: [DayRun]()) { runs, entry in
            guard runs.last?.day == entry.day else {
                runs.append(DayRun(day: entry.day, tasks: [entry.task]))
                return
            }
            runs[runs.count - 1].tasks.append(entry.task)
        }
        return runs.map { TaskDay(day: $0.day, tasks: $0.tasks) }
    }
}
