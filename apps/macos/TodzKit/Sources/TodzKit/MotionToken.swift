public enum MotionTiming {
    // NB ADR 0077: every motion effect in todz lasts at most 350 milliseconds.
    public static let ceilingMilliseconds = 350
    public static let millisecondsPerSecond = 1000.0
}

public enum MotionCurve: Sendable, Equatable {
    case spring(response: Double, dampingFraction: Double)
    case easeOut
    case ease
}

public enum MotionToken: CaseIterable, Sendable, Equatable {
    case snap
    case settle
    case bloom
    case reveal
    case draw
    case sparkle
    case crossfade

    public var durationMilliseconds: Int {
        fatalError("MotionToken.durationMilliseconds is not implemented")
    }

    public var curve: MotionCurve {
        fatalError("MotionToken.curve is not implemented")
    }
}
