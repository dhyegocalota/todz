public struct TaskDraft: Encodable, Sendable, Equatable {
    public let title: String
    public let notes: String?
    public let dueDate: CalendarDate?
    public let idempotencyKey: String

    public init(title: String, notes: String?, dueDate: CalendarDate?, idempotencyKey: String) {
        self.title = title
        self.notes = notes
        self.dueDate = dueDate
        self.idempotencyKey = idempotencyKey
    }
}
