import Foundation
import Observation

@MainActor @Observable public final class RibbonCoordinator {
    // NB ADR 0071: an agent burst settles for 3 s and at most one agent ribbon shows in 10 minutes.
    static let agentSettle: TimeInterval = 3
    static let agentCooldown: TimeInterval = 10 * 60

    public private(set) var presentation: RibbonPresentation?
    @ObservationIgnored var waiting: Task<Void, Never>?
    @ObservationIgnored var running: Task<Void, Never>?
    @ObservationIgnored var settling: Task<Void, Never>?
    @ObservationIgnored var releaseTaking: Task<Void, Never>?
    @ObservationIgnored var quietEnding: Task<Void, Never>?
    @ObservationIgnored private var lastAgentShownAt: Date?
    @ObservationIgnored private let gate: ProactiveGate
    @ObservationIgnored private let preference: RibbonPreference
    @ObservationIgnored private let isDayCloseOn: () -> Bool
    @ObservationIgnored private let timeZone: TimeZone
    @ObservationIgnored private let now: () -> Date
    @ObservationIgnored private let pause: (Duration) async throws -> Void
    @ObservationIgnored private let content: () -> RibbonContent?
    @ObservationIgnored private let isScreenLocked: () -> Bool
    @ObservationIgnored private let isPopoverVisible: () -> Bool
    @ObservationIgnored private let isMotionReduced: () -> Bool
    @ObservationIgnored private let textWidth: (RibbonContent) -> Double

    public init(
        gate: ProactiveGate,
        preference: RibbonPreference,
        isDayCloseOn: @escaping () -> Bool,
        timeZone: TimeZone,
        now: @escaping () -> Date = Date.init,
        pause: @escaping (Duration) async throws -> Void,
        content: @escaping () -> RibbonContent?,
        isScreenLocked: @escaping () -> Bool,
        isPopoverVisible: @escaping () -> Bool,
        isMotionReduced: @escaping () -> Bool,
        textWidth: @escaping (RibbonContent) -> Double
    ) {
        self.gate = gate
        self.preference = preference
        self.isDayCloseOn = isDayCloseOn
        self.timeZone = timeZone
        self.now = now
        self.pause = pause
        self.content = content
        self.isScreenLocked = isScreenLocked
        self.isPopoverVisible = isPopoverVisible
        self.isMotionReduced = isMotionReduced
        self.textWidth = textWidth
        observeReleases()
        observeQuiet()
    }

    public func refresh() {
        waiting?.cancel()
        waiting = nil
        guard preference.isOn else {
            end()
            return
        }
        let instant = now()
        guard let cadence = preference.cadence else { return }
        let next = RibbonSchedule.nextShowing(
            after: instant,
            cadence: cadence,
            closeMinutesAfterMidnight: preference.closeMinutesAfterMidnight,
            timeZone: timeZone
        )
        guard let next else { return }
        waiting = Task { [weak self] in
            await self?.wait(seconds: next.timeIntervalSince(instant))
        }
    }

    public func agentChanged() {
        guard isAgentRibbonWanted else { return }
        settling?.cancel()
        settling = Task { [weak self] in
            await self?.settleAndShow()
        }
    }

    public func end() {
        running?.cancel()
        running = nil
        presentation = nil
    }

    private var isAgentRibbonWanted: Bool {
        guard preference.isOn, preference.cadence == .agentChange else { return false }
        guard let lastAgentShownAt else { return true }
        return now().timeIntervalSince(lastAgentShownAt) >= Self.agentCooldown
    }

    private func wait(seconds: TimeInterval) async {
        do {
            try await pause(.seconds(seconds))
            try Task.checkCancellation()
        } catch {
            return
        }
        showAtBoundary()
        await running?.value
        guard !Task.isCancelled else { return }
        refresh()
    }

    private func settleAndShow() async {
        do {
            try await pause(.seconds(Self.agentSettle))
            try Task.checkCancellation()
        } catch {
            return
        }
        guard preference.cadence == .agentChange else { return }
        show()
    }

    private func showAtBoundary() {
        let isDayCloseCoveringTheBoundary = preference.cadence == .dayClose && isDayCloseOn()
        let isBoundaryCadence = preference.cadence == .hourly || preference.cadence == .dayClose
        guard isBoundaryCadence, !isDayCloseCoveringTheBoundary else { return }
        show()
    }

    private func show() {
        guard preference.isOn, running == nil else { return }
        let isInTheWay = isScreenLocked() || isPopoverVisible()
        guard !isInTheWay, let content = content() else { return }
        guard gate.admit(.ribbon) == .show else { return }
        start(content)
    }

    private func start(_ content: RibbonContent) {
        let width = textWidth(content)
        let frames = RibbonMotion.timeline(textWidth: width, isMotionReduced: isMotionReduced())
        if preference.cadence == .agentChange { lastAgentShownAt = now() }
        running = Task { [weak self] in
            await self?.play(frames, content: content, textWidth: width)
        }
    }

    private func play(_ frames: [RibbonFrame], content: RibbonContent, textWidth: Double) async {
        for frame in frames {
            presentation = RibbonPresentation(content: content, frame: frame, textWidth: textWidth)
            do {
                try await pause(frame.duration)
                try Task.checkCancellation()
            } catch {
                return
            }
        }
        presentation = nil
        running = nil
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
        guard gate.claimRelease(.ribbon) else { return }
        show()
    }

    private func observeQuiet() {
        withObservationTracking {
            _ = gate.isQuiet
        } onChange: { [weak self] in
            MainActor.assumeIsolated {
                self?.quietEnding = Task { [weak self] in
                    self?.endWhenQuiet()
                    self?.observeQuiet()
                }
            }
        }
    }

    private func endWhenQuiet() {
        guard gate.isQuiet else { return }
        end()
    }
}
