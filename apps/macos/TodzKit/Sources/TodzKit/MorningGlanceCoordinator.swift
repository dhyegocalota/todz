import Foundation
import Observation

@MainActor @Observable public final class MorningGlanceCoordinator {
    @ObservationIgnored var releaseTaking: Task<Void, Never>?
    @ObservationIgnored var contentWaiting: Task<Void, Never>?
    @ObservationIgnored var shownContentReviewing: Task<Void, Never>?

    public init(
        gate: ProactiveGate,
        defaults: UserDefaults,
        timeZone: TimeZone,
        now: @escaping () -> Date = Date.init,
        content: @escaping () -> MorningGlanceContent?,
        isScreenLocked: @escaping () -> Bool,
        isScreenMirrored: @escaping () -> Bool,
        isTodayInFront: @escaping () -> Bool,
        showPanel: @escaping (MorningGlanceContent) async -> Bool,
        closePanel: @escaping () -> Void
    ) {
        fatalError("MorningGlanceCoordinator.init is not implemented")
    }

    public var isShowing: Bool {
        fatalError("MorningGlanceCoordinator.isShowing is not implemented")
    }

    public func check() async {
        fatalError("MorningGlanceCoordinator.check is not implemented")
    }

    public func retryLockedChance() async {
        fatalError("MorningGlanceCoordinator.retryLockedChance is not implemented")
    }

    public func popoverShown() {
        fatalError("MorningGlanceCoordinator.popoverShown is not implemented")
    }

    public func closeNow() {
        fatalError("MorningGlanceCoordinator.closeNow is not implemented")
    }

    public func dismissed() {
        fatalError("MorningGlanceCoordinator.dismissed is not implemented")
    }
}
