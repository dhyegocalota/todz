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
        switch self {
        case .snap: 200
        case .settle: 320
        case .bloom: 300
        case .reveal: 340
        case .draw: 250
        case .sparkle: 300
        case .crossfade: 150
        }
    }

    public var curve: MotionCurve {
        switch self {
        case .snap: .spring(response: 0.2, dampingFraction: 0.9)
        case .settle: .spring(response: 0.32, dampingFraction: 0.72)
        case .bloom: .spring(response: 0.3, dampingFraction: 0.8)
        case .reveal: .spring(response: 0.34, dampingFraction: 0.9)
        case .draw: .easeOut
        case .sparkle: .easeOut
        case .crossfade: .ease
        }
    }
}
