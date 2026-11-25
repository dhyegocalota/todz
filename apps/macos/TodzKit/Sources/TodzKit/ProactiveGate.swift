import Observation

@MainActor @Observable public final class ProactiveGate {
    public private(set) var released: [ProactiveSurface] = []
    private var respectsFocus: Bool
    private var isFocusQuiet = false
    private var held: [ProactiveSurface] = []
    @ObservationIgnored private var hasFocusChanged = false

    public init(respectsFocus: Bool) {
        self.respectsFocus = respectsFocus
    }

    public var isQuiet: Bool {
        respectsFocus && isFocusQuiet
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

    // NB ADR 0068: the gate is quiet only while Respect Focus is on and the filter is quiet; turning the switch off releases what was held.
    public func setRespectsFocus(_ respectsFocus: Bool) {
        change { self.respectsFocus = respectsFocus }
    }

    // NB ADR 0054: a perform() that arrives first wins over the launch read of the filter.
    public func setQuiet(_ isQuiet: Bool) {
        hasFocusChanged = true
        change { isFocusQuiet = isQuiet }
    }

    public func applyLaunchRead(isQuiet: Bool) {
        guard !hasFocusChanged else { return }
        change { isFocusQuiet = isQuiet }
    }

    private func change(_ update: () -> Void) {
        let wasQuiet = isQuiet
        update()
        let isQuietEnding = wasQuiet && !isQuiet
        guard isQuietEnding else { return }
        released.append(contentsOf: held.filter { !released.contains($0) })
        held = []
    }
}
