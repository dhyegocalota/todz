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

    public func refresh() {
        fatalError("DayTemperatureClock.refresh is not implemented")
    }
}
