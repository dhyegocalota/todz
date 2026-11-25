import Foundation
import Observation

@MainActor @Observable public final class DayCloseCoordinator {
    public private(set) var isClosingDay = false
    public private(set) var isEngaged = false
    @ObservationIgnored var releaseTaking: Task<Void, Never>?
    @ObservationIgnored var countWaiting: Task<Void, Never>?
    @ObservationIgnored private var isWaitingForCount = false
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
        observeReleases()
    }

    @discardableResult
    public func check() -> DayCloseDecision {
        guard decision == .due else { return decision }
        closeTheDay()
        return decision
    }

    public func end() {
        isClosingDay = false
    }

    public var acceptsKeyActions: Bool {
        !isClosingDay || isEngaged
    }

    public func engage() {
        isEngaged = true
    }

    private var decision: DayCloseDecision {
        DayCloseSchedule.decision(
            at: now(),
            minutesAfterMidnight: DayClosePreference.minutesAfterMidnight(in: defaults),
            lastClosedDay: DayClosePreference.lastClosedDay(in: defaults),
            isOn: DayClosePreference.isOn(in: defaults),
            timeZone: timeZone
        )
    }

    // NB ADR 0055: nothing left marks the day closed without opening; a held or failed opening leaves the day unmarked.
    private func closeTheDay() {
        guard let openCount = openCount() else {
            waitForCount()
            return
        }
        guard openCount > 0 else {
            markClosed()
            return
        }
        guard gate.admit(.dayClose) == .show else { return }
        open()
    }

    private func open() {
        isEngaged = false
        isClosingDay = true
        guard openPopover() else {
            isClosingDay = false
            return
        }
        markClosed()
    }

    private func markClosed() {
        DayClosePreference.markClosed(day: CalendarDate.today(in: timeZone, at: now()), in: defaults)
    }

    private func waitForCount() {
        guard !isWaitingForCount else { return }
        isWaitingForCount = true
        withObservationTracking {
            _ = openCount()
        } onChange: { [weak self] in
            MainActor.assumeIsolated {
                self?.countWaiting = Task { [weak self] in
                    self?.isWaitingForCount = false
                    self?.check()
                }
            }
        }
    }

    private func observeReleases() {
        withObservationTracking {
            _ = gate.released
        } onChange: { [weak self] in
            MainActor.assumeIsolated {
                self?.releaseTaking = Task { [weak self] in
                    self?.takeRelease()
                    self?.observeReleases()
                }
            }
        }
    }

    private func takeRelease() {
        guard gate.claimRelease(.dayClose) else { return }
        check()
    }
}
