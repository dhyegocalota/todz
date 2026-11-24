public enum TaskPlacement: Sendable, Equatable {
    case first
    case after(anchor: Int)
}
