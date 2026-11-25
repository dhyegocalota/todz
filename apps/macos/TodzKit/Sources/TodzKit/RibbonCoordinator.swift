import Foundation
import Observation

@MainActor @Observable public final class RibbonCoordinator {
    static let agentSettle: TimeInterval = 3
    static let agentCooldown: TimeInterval = 10 * 60

    public private(set) var presentation: RibbonPresentation?
    @ObservationIgnored var waiting: Task<Void, Never>?
    @ObservationIgnored var running: Task<Void, Never>?
    @ObservationIgnored var settling: Task<Void, Never>?
    @ObservationIgnored var releaseTaking: Task<Void, Never>?
    @ObservationIgnored var quietEnding: Task<Void, Never>?

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
    ) {}

    public func refresh() {
        fatalError("RibbonCoordinator.refresh is not implemented")
    }

    public func agentChanged() {
        fatalError("RibbonCoordinator.agentChanged is not implemented")
    }

    public func end() {
        fatalError("RibbonCoordinator.end is not implemented")
    }
}
