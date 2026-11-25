import Foundation

private let readTimeout: Duration = .seconds(3)

@MainActor public final class FocusSwitchCoordinator {
    var reading: Task<Void, Never>?
    private var isRespectingFocus = false
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
        let isOn = preference.isOn
        guard isOn != isRespectingFocus else { return }
        isRespectingFocus = isOn
        gate.setRespectsFocus(isOn)
        guard isOn else { return }
        await readFocus()
    }

    // NB ADR 0054: a filter read that outlasts the timeout quiets the gate, and its later answer releases it.
    private func readFocus() async {
        let (settlements, settle) = AsyncStream.makeStream(of: Void.self)
        let timeout = Task { [gate, pause] in
            try? await pause(readTimeout)
            guard !Task.isCancelled else { return }
            gate.applyLaunchRead(isQuiet: true)
            settle.yield()
        }
        reading = Task { [gate, readFilter] in
            let isQuiet = await readFilter()
            timeout.cancel()
            gate.applyLaunchRead(isQuiet: isQuiet)
            settle.yield()
        }
        for await _ in settlements { return }
    }
}
