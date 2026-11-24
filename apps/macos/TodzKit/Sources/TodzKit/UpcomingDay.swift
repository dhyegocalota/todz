public struct UpcomingDay: Sendable, Equatable {
    public let day: CalendarDate
    public let tasks: [BoardTask]
    public let pendingTasks: [PendingTask]
}
