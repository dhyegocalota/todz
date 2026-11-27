public enum MotionTreatment: Sendable, Equatable {
    case animate
    case crossfade
    case instant
}

public enum MotionTransform: Sendable, Equatable {
    case none
    case scale(Double)
    case offset(vertical: Double)
}

public struct MotionSpec: Equatable, Sendable {
    public let treatment: MotionTreatment
    public let token: MotionToken?
    public let transform: MotionTransform
    public let delayMilliseconds: Int

    public static func of(_ moment: MotionMoment, isReduceMotionOn: Bool, index: Int) -> MotionSpec {
        MotionSpec(treatment: .instant, token: nil, transform: .none, delayMilliseconds: 0)
    }
}
