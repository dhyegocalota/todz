public enum TaskPatch: Sendable, Equatable {
    case title(String)
    case notes(String?)
    case dueDate(CalendarDate?)
    case placement(TaskPlacement)
}
