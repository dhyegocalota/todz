import Foundation
import Observation

@MainActor @Observable public final class DayTemperatureClock {
    public private(set) var step = DayTemperatureStep.plain
    @ObservationIgnored var waiting: Task<Void, Never>?
    @ObservationIgnored private let timeZone: TimeZone
    @ObservationIgnored private let now: () -> Date
    @ObservationIgnored private let pause: (Duration) async throws -> Void
    @ObservationIgnored private let isOn: () -> Bool

    public init(
        timeZone: TimeZone,
        now: @escaping () -> Date = Date.init,
        pause: @escaping (Duration) async throws -> Void,
        isOn: @escaping () -> Bool
    ) {
        self.timeZone = timeZone
        self.now = now
        self.pause = pause
        self.isOn = isOn
    }

    // NB ADR 0065: one wait to the next boundary, at most four a day, restarted on wake, unlock, zone, clock and defaults changes.
    public func refresh() {
        waiting?.cancel()
        guard isOn() else {
            step = .plain
            waiting = nil
            return
        }
        let instant = now()
        step = DayTemperatureStep.step(at: instant, in: timeZone)
        waiting = Task { [weak self] in
            await self?.wait(after: instant)
        }
    }

    private func wait(after instant: Date) async {
        let next = DayTemperatureStep.nextBoundary(after: instant, in: timeZone)
        do {
            try await pause(.seconds(next.timeIntervalSince(instant)))
        } catch {
            return
        }
        refresh()
    }
}
