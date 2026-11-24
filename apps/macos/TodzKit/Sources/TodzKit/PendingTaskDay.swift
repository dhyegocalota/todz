public struct PendingTaskDay: Sendable, Equatable {
    public let day: CalendarDate
    public let tasks: [PendingTask]
}
