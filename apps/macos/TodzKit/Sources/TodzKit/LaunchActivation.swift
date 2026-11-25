public enum LaunchActivation: Equatable, Sendable {
    case atLaunch
    case afterTheFirstWindowEvent

    // NB ADR 0074: a default launch opens the window, so its policy waits for the first window event and the Dock never flickers.
    public static func of(isDefaultLaunch: Bool?) -> LaunchActivation {
        guard isDefaultLaunch == false else { return .afterTheFirstWindowEvent }
        return .atLaunch
    }
}
