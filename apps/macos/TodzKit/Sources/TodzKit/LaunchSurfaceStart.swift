public enum LaunchSurfaceStart: Equatable, Sendable {
    case now
    case afterTheOwnerEngages

    // NB ADR 0066: only a launch that is not the default launch and cannot activate is an intent launch, which starts no pushed surface.
    public static func of(isDefaultLaunch: Bool?, isActivationProhibited: Bool) -> LaunchSurfaceStart {
        let isIntentLaunch = isDefaultLaunch == false && isActivationProhibited
        return isIntentLaunch ? .afterTheOwnerEngages : .now
    }
}
