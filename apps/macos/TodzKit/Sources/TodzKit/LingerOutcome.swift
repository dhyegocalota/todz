public enum LingerOutcome: Equatable, Sendable {
    case done
    case dueTomorrow
    case noDueDate

    var state: TaskState {
        switch self {
        case .done: .done
        case .dueTomorrow, .noDueDate: .open
        }
    }
}
