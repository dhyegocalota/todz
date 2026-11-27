public enum CountDirection: Sendable, Equatable {
    case up
    case down
    case unchanged

    public static func of(from: Int, to: Int) -> CountDirection {
        .unchanged
    }

    public var countsDown: Bool {
        false
    }
}
