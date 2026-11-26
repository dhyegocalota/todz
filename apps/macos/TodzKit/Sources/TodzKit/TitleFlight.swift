public struct TitleFlightPoint: Equatable, Sendable {
    public let x: Double
    public let y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }
}

public struct TitleFlightStart: Equatable, Sendable {
    public let offsetX: Double
    public let offsetY: Double
    public let opacity: Double

    public init(offsetX: Double, offsetY: Double, opacity: Double) {
        self.offsetX = offsetX
        self.offsetY = offsetY
        self.opacity = opacity
    }
}

public enum TitleFlight {
    // NB ADR 0106: the header title starts at the selected sidebar row and settles into place; a title with no measured row, or under Reduce Motion, does not fly.
    public static func start(source: TitleFlightPoint?, rest: TitleFlightPoint, isMotionReduced: Bool) -> TitleFlightStart {
        guard let source else { return TitleFlightStart(offsetX: 0, offsetY: 0, opacity: 1) }
        guard !isMotionReduced else { return TitleFlightStart(offsetX: 0, offsetY: 0, opacity: 0) }
        return TitleFlightStart(offsetX: source.x - rest.x, offsetY: source.y - rest.y, opacity: 0)
    }

    public static func token(isMotionReduced: Bool) -> MotionToken {
        MotionRule.token(.settle, isReduceMotionOn: isMotionReduced)
    }
}
