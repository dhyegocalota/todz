public enum MotionTiming {
    // NB ADR 0077: every motion effect in todz lasts at most 350 milliseconds.
    public static let ceilingMilliseconds = 350
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
    case press

    public var durationMilliseconds: Int {
        switch self {
        case .snap: 200
        case .settle: 320
        case .bloom: 300
        case .reveal: 340
        case .draw: 250
        case .sparkle: 300
        case .crossfade: 150
        case .press: 0
        }
    }

    public var curve: MotionCurve {
        switch self {
        case .snap: .spring(response: 0.105, dampingFraction: 0.95)
        case .settle: .spring(response: 0.17, dampingFraction: 0.9)
        case .bloom: .spring(response: 0.16, dampingFraction: 0.9)
        case .reveal: .spring(response: 0.18, dampingFraction: 0.9)
        case .draw: .easeOut
        case .sparkle: .easeOut
        case .crossfade: .ease
        case .press: .ease
        }
    }
}
