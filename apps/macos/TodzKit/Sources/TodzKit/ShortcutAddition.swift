public enum ShortcutAddition: Equatable, Sendable {
    case added(title: String, destination: ShortcutAddDestination, workspaceName: String, isOffline: Bool)
    case refused(RuleIssue)
    case noWorkspace
    case signedOut
}
