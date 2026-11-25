import Foundation
import Observation

@MainActor @Observable public final class DayCloseCoordinator {
    public private(set) var isClosingDay = false
    @ObservationIgnored var releaseTaking: Task<Void, Never>?
    @ObservationIgnored var countWaiting: Task<Void, Never>?
    @ObservationIgnored private let gate: ProactiveGate
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let timeZone: TimeZone
    @ObservationIgnored private let now: () -> Date
    @ObservationIgnored private let openCount: () -> Int?
    @ObservationIgnored private let openPopover: () -> Bool

    public init(
        gate: ProactiveGate,
        defaults: UserDefaults,
        timeZone: TimeZone,
        now: @escaping () -> Date = Date.init,
        openCount: @escaping () -> Int?,
        openPopover: @escaping () -> Bool
    ) {
        self.gate = gate
        self.defaults = defaults
        self.timeZone = timeZone
        self.now = now
        self.openCount = openCount
        self.openPopover = openPopover
    }

    @discardableResult
    public func check() -> DayCloseDecision {
        fatalError("DayCloseCoordinator.check is not implemented")
    }

    public func end() {
        fatalError("DayCloseCoordinator.end is not implemented")
    }
}
