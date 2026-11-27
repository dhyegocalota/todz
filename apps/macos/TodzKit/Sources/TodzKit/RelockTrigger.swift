public enum RelockTrigger: CaseIterable, Sendable {
    case systemSleep
    case screenLocked
    case screensaverStarted
    case idle
    case manual
}
