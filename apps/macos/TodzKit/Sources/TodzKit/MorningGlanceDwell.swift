import Foundation

public struct MorningGlanceDwell: Equatable, Sendable {
    public static var showDuration: TimeInterval { fatalError("MorningGlanceDwell.showDuration is not implemented") }
    public static var longestShow: TimeInterval { fatalError("MorningGlanceDwell.longestShow is not implemented") }
    public static var pointerGrace: TimeInterval { fatalError("MorningGlanceDwell.pointerGrace is not implemented") }

    public static func fadeDuration(reducesMotion: Bool) -> TimeInterval {
        fatalError("MorningGlanceDwell.fadeDuration is not implemented")
    }

    public init(shownAt: Date) {
        fatalError("MorningGlanceDwell.init is not implemented")
    }

    public var fadeStart: Date {
        fatalError("MorningGlanceDwell.fadeStart is not implemented")
    }

    public func hovered(at instant: Date) -> MorningGlanceDwell {
        fatalError("MorningGlanceDwell.hovered is not implemented")
    }

    public func left(at instant: Date) -> MorningGlanceDwell {
        fatalError("MorningGlanceDwell.left is not implemented")
    }
}
