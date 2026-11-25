import Foundation

@MainActor public final class FocusSwitchCoordinator {
    var reading: Task<Void, Never>?
    private let gate: ProactiveGate
    private let preference: RespectFocusPreference
    private let readFilter: () async -> Bool
    private let pause: (Duration) async throws -> Void

    public init(
        gate: ProactiveGate,
        preference: RespectFocusPreference,
        readFilter: @escaping () async -> Bool,
        pause: @escaping (Duration) async throws -> Void
    ) {
        self.gate = gate
        self.preference = preference
        self.readFilter = readFilter
        self.pause = pause
    }

    public func start() async {
        await synchronize()
    }

    public func preferencesChanged() async {
        await synchronize()
    }

    private func synchronize() async {
        fatalError("FocusSwitchCoordinator.start is not implemented")
    }
}
