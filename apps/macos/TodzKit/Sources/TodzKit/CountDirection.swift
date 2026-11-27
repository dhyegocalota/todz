public enum CountDirection: Sendable, Equatable {
    case up
    case down
    case unchanged

    public static func of(from: Int, to: Int) -> CountDirection {
        guard from != to else { return .unchanged }
        return to < from ? .down : .up
    }

    public var countsDown: Bool {
        self == .down
    }
}
