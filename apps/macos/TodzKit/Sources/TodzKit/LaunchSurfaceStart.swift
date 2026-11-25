public enum LaunchSurfaceStart: Equatable, Sendable {
    case now
    case afterTheOwnerEngages

    public static func of(isDefaultLaunch: Bool?, isActivationProhibited: Bool) -> LaunchSurfaceStart {
        fatalError("LaunchSurfaceStart.of(isDefaultLaunch:isActivationProhibited:) is not implemented")
    }
}
