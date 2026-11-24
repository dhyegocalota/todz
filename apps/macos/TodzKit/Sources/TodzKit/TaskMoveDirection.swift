private let offsetAboveThePreviousTask = -1
private let offsetBelowTheNextTask = 2

public enum TaskMoveDirection: Sendable {
    case up
    case down

    var offsetStep: Int {
        switch self {
        case .up: offsetAboveThePreviousTask
        case .down: offsetBelowTheNextTask
        }
    }
}
