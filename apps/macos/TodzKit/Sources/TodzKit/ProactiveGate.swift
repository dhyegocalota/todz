import Observation

@MainActor @Observable public final class ProactiveGate {
    public var isQuiet: Bool {
        fatalError("isQuiet is not implemented")
    }

    public var released: [ProactiveSurface] {
        fatalError("released is not implemented")
    }

    public init() {}

    public func admit(_ surface: ProactiveSurface) -> GateDecision {
        fatalError("admit is not implemented")
    }

    public func claimRelease(_ surface: ProactiveSurface) -> Bool {
        fatalError("claimRelease is not implemented")
    }

    public func setQuiet(_ isQuiet: Bool) {
        fatalError("setQuiet is not implemented")
    }

    public func applyLaunchRead(isQuiet: Bool) {
        fatalError("applyLaunchRead is not implemented")
    }
}
