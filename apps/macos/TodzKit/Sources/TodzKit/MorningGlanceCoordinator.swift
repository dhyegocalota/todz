import Foundation
import Observation

private struct Chance {
    let day: CalendarDate
    let startedAt: Date
}

private enum PanelState {
    case hidden
    case opening
    case onScreen
}

@MainActor @Observable public final class MorningGlanceCoordinator {
    static let countWait: TimeInterval = 60

    private var panelState = PanelState.hidden
    @ObservationIgnored var releaseTaking: Task<Void, Never>?
    @ObservationIgnored var contentWaiting: Task<Void, Never>?
    @ObservationIgnored var shownContentReviewing: Task<Void, Never>?
    @ObservationIgnored private var isInterruptedWhileOpening = false
    @ObservationIgnored private var isWaitingForContent = false
    @ObservationIgnored private var waitingChance: Chance?
    @ObservationIgnored private var lockedChance: Chance?
    @ObservationIgnored private var heldDay: CalendarDate?
    @ObservationIgnored private var showGeneration = 0
    @ObservationIgnored private let gate: ProactiveGate
    @ObservationIgnored private let preference: MorningGlancePreference
    @ObservationIgnored private let timeZone: TimeZone
    @ObservationIgnored private let now: () -> Date
    @ObservationIgnored private let content: () -> MorningGlanceContent?
    @ObservationIgnored private let isScreenLocked: () -> Bool
    @ObservationIgnored private let isScreenMirrored: () -> Bool
    @ObservationIgnored private let isScreenCaptured: () -> Bool
    @ObservationIgnored private let isTodayInFront: () -> Bool
    @ObservationIgnored private let showPanel: (MorningGlanceContent) async -> Bool
    @ObservationIgnored private let closePanel: () -> Void

    public init(
        gate: ProactiveGate,
        preference: MorningGlancePreference,
        timeZone: TimeZone,
        now: @escaping () -> Date = Date.init,
        content: @escaping () -> MorningGlanceContent?,
        isScreenLocked: @escaping () -> Bool,
        isScreenMirrored: @escaping () -> Bool,
        isScreenCaptured: @escaping () -> Bool,
        isTodayInFront: @escaping () -> Bool,
        showPanel: @escaping (MorningGlanceContent) async -> Bool,
        closePanel: @escaping () -> Void
    ) {
        self.gate = gate
        self.preference = preference
        self.timeZone = timeZone
        self.now = now
        self.content = content
        self.isScreenLocked = isScreenLocked
        self.isScreenMirrored = isScreenMirrored
        self.isScreenCaptured = isScreenCaptured
        self.isTodayInFront = isTodayInFront
        self.showPanel = showPanel
        self.closePanel = closePanel
        observeReleases()
    }

    public var isShowing: Bool {
        panelState != .hidden
    }

    public func check() async {
        await run(freshChance())
    }

    public func retryLockedChance() async {
        guard lockedChance != nil else { return }
        await run(freshChance())
    }

    public func popoverShown() {
        closeNow()
    }

    public func closeNow() {
        switch panelState {
        case .hidden: return
        case .opening: isInterruptedWhileOpening = true
        case .onScreen: endShow()
        }
    }

    public func dismissed() {
        guard panelState == .onScreen else { return }
        showGeneration += 1
        panelState = .hidden
    }

    private func freshChance() -> Chance {
        let instant = now()
        return Chance(day: CalendarDate.today(in: timeZone, at: instant), startedAt: instant)
    }

    private func run(_ chance: Chance) async {
        lockedChance = nil
        guard preference.isOn else { return }
        guard preference.lastShownDay != chance.day else { return }
        guard panelState == .hidden else { return }
        guard let content = content() else {
            waitForContent(chance)
            return
        }
        guard content.openCount > 0 else {
            markShown(day: chance.day)
            return
        }
        guard !isTodayInFront() else {
            markShown(day: chance.day)
            return
        }
        guard !isScreenMirrored() else { return }
        guard !isScreenLocked() else {
            lockedChance = chance
            return
        }
        guard gate.admit(.morningGlance) == .show else {
            heldDay = chance.day
            return
        }
        await show(content, chance: chance)
    }

    private func show(_ content: MorningGlanceContent, chance: Chance) async {
        panelState = .opening
        isInterruptedWhileOpening = false
        let isSeen = await showPanel(content)
        guard isSeen else {
            panelState = .hidden
            return
        }
        guard !isScreenLocked() else {
            endShow()
            return
        }
        markShown(day: chance.day)
        guard !isInterruptedWhileOpening, !isTodayInFront() else {
            endShow()
            return
        }
        panelState = .onScreen
        observeShown(workspaceIdentifier: content.workspaceIdentifier, generation: showGeneration)
    }

    // NB ADR 0062: the day is marked only once the panel is seen, and only the chance's own day.
    private func markShown(day: CalendarDate) {
        preference.markShown(day: day)
    }

    private func endShow() {
        showGeneration += 1
        panelState = .hidden
        closePanel()
    }

    private func waitForContent(_ chance: Chance) {
        waitingChance = chance
        guard !isWaitingForContent else { return }
        isWaitingForContent = true
        withObservationTracking {
            _ = content()
        } onChange: { [weak self] in
            MainActor.assumeIsolated {
                self?.contentWaiting = Task { [weak self] in
                    await self?.continueWaitingChance()
                }
            }
        }
    }

    private func continueWaitingChance() async {
        isWaitingForContent = false
        guard let chance = waitingChance else { return }
        waitingChance = nil
        let isInTime = now().timeIntervalSince(chance.startedAt) <= Self.countWait
        guard isInTime else { return }
        await run(chance)
    }

    private func observeShown(workspaceIdentifier: String, generation: Int) {
        withObservationTracking {
            _ = content()
        } onChange: { [weak self] in
            MainActor.assumeIsolated {
                self?.shownContentReviewing = Task { [weak self] in
                    self?.reviewShown(workspaceIdentifier: workspaceIdentifier, generation: generation)
                }
            }
        }
    }

    private func reviewShown(workspaceIdentifier: String, generation: Int) {
        guard generation == showGeneration, panelState == .onScreen else { return }
        guard content()?.workspaceIdentifier == workspaceIdentifier else {
            endShow()
            return
        }
        observeShown(workspaceIdentifier: workspaceIdentifier, generation: generation)
    }

    private func observeReleases() {
        withObservationTracking {
            _ = gate.released
        } onChange: { [weak self] in
            MainActor.assumeIsolated {
                self?.releaseTaking = Task { [weak self] in
                    await self?.takeRelease()
                    self?.observeReleases()
                }
            }
        }
    }

    private func takeRelease() async {
        guard gate.claimRelease(.morningGlance) else { return }
        let chance = freshChance()
        let releasedDay = heldDay
        heldDay = nil
        guard releasedDay == chance.day else { return }
        await run(chance)
    }
}
