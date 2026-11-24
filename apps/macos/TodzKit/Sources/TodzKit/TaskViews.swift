import Foundation

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
        fatalError("TaskViews is not implemented")
    }

    public func project(identifier: String) -> [BoardTask] {
        fatalError("TaskViews is not implemented")
    }

    public var today: TodayTasks {
        fatalError("TaskViews is not implemented")
    }

    public var upcoming: [BoardTask] {
        fatalError("TaskViews is not implemented")
    }

    public var done: [BoardTask] {
        fatalError("TaskViews is not implemented")
    }
}
