import Observation

@MainActor @Observable public final class ProactiveGate {
    public private(set) var isQuiet = false
    public private(set) var released: [ProactiveSurface] = []
    private var held: [ProactiveSurface] = []
    @ObservationIgnored private var hasFocusChanged = false

    public init(respectsFocus: Bool) {}

    public func setRespectsFocus(_ respectsFocus: Bool) {
        fatalError("ProactiveGate.setRespectsFocus is not implemented")
    }

    public func admit(_ surface: ProactiveSurface) -> GateDecision {
        guard isQuiet else { return .show }
        guard !held.contains(surface) else { return .held }
        held.append(surface)
        return .held
    }

    public func claimRelease(_ surface: ProactiveSurface) -> Bool {
        guard !isQuiet, released.contains(surface) else { return false }
        released.removeAll { $0 == surface }
        return true
    }

    // NB ADR 0054: a perform() that arrives first wins over the launch read of the filter.
    public func setQuiet(_ isQuiet: Bool) {
        hasFocusChanged = true
        changeQuiet(to: isQuiet)
    }

    public func applyLaunchRead(isQuiet: Bool) {
        guard !hasFocusChanged else { return }
        changeQuiet(to: isQuiet)
    }

    private func changeQuiet(to isQuiet: Bool) {
        let isQuietEnding = self.isQuiet && !isQuiet
        self.isQuiet = isQuiet
        guard isQuietEnding else { return }
        released.append(contentsOf: held.filter { !released.contains($0) })
        held = []
    }
}
