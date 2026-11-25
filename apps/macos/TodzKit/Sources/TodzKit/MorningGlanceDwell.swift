import Foundation

public struct MorningGlanceDwell: Equatable, Sendable {
    public static let showDuration: TimeInterval = 5
    public static let longestShow: TimeInterval = 30
    public static let pointerGrace: TimeInterval = 0.4
    private static let fadeSeconds: TimeInterval = 0.5

    private enum Pointer: Equatable, Sendable {
        case over
        case away(since: Date)
    }

    private let shownAt: Date
    private let pointer: Pointer

    public static func fadeDuration(reducesMotion: Bool) -> TimeInterval {
        reducesMotion ? 0 : fadeSeconds
    }

    public init(shownAt: Date) {
        self.init(shownAt: shownAt, pointer: .away(since: shownAt))
    }

    private init(shownAt: Date, pointer: Pointer) {
        self.shownAt = shownAt
        self.pointer = pointer
    }

    public var fadeStart: Date {
        let cap = shownAt.addingTimeInterval(Self.longestShow)
        switch pointer {
        case .over: return cap
        case let .away(since): return min(since.addingTimeInterval(Self.showDuration), cap)
        }
    }

    public func hovered() -> MorningGlanceDwell {
        MorningGlanceDwell(shownAt: shownAt, pointer: .over)
    }

    public func left(at instant: Date) -> MorningGlanceDwell {
        MorningGlanceDwell(shownAt: shownAt, pointer: .away(since: instant))
    }
}
