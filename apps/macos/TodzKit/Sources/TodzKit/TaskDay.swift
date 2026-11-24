public struct TaskDay: Sendable, Equatable {
    public let day: CalendarDate
    public let tasks: [BoardTask]
}
