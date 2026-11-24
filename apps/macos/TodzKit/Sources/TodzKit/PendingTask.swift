public struct PendingTask: Sendable, Equatable {
    public let projectIdentifier: String
    public let idempotencyKey: String
    public let title: String
    public let dueDate: CalendarDate?
}
