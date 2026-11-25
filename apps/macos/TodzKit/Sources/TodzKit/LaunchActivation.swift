public enum LaunchActivation: Equatable, Sendable {
    case atLaunch
    case afterTheFirstWindowEvent

    public static func of(isDefaultLaunch: Bool?) -> LaunchActivation {
        fatalError("LaunchActivation.of is not implemented")
    }
}
