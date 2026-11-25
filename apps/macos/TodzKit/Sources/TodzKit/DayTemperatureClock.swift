import Foundation
import Observation

@MainActor @Observable public final class DayTemperatureClock {
    public private(set) var step = DayTemperatureStep.plain
    public private(set) var isOn = false
    @ObservationIgnored var waiting: Task<Void, Never>?
    @ObservationIgnored private let now: () -> Date
    @ObservationIgnored private let timeZone: () -> TimeZone
    @ObservationIgnored private let readsIsOn: () -> Bool
    @ObservationIgnored private let pause: (Duration) async throws -> Void

    public init(
        now: @escaping () -> Date,
        timeZone: @escaping () -> TimeZone,
        isOn: @escaping () -> Bool,
        pause: @escaping (Duration) async throws -> Void
    ) {
        self.now = now
        self.timeZone = timeZone
        self.readsIsOn = isOn
        self.pause = pause
    }

    // NB ADR 0065: one wait to the next boundary, at most four a day, restarted on wake, unlock, zone, clock and defaults changes.
    public func refresh() {
        waiting?.cancel()
        isOn = readsIsOn()
        guard isOn else {
            step = .plain
            waiting = nil
            return
        }
        let instant = now()
        step = DayTemperatureStep.step(at: instant, in: timeZone())
        waiting = Task { [weak self] in
            await self?.wait(after: instant)
        }
    }

    private func wait(after instant: Date) async {
        let next = DayTemperatureStep.nextBoundary(after: instant, in: timeZone())
        do {
            try await pause(.seconds(next.timeIntervalSince(instant)))
        } catch {
            return
        }
        refresh()
    }
}
