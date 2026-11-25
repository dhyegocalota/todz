public enum AppBanner: Equatable, Sendable {
    case network
    case server
    case someProjectsFailed
    case changeNotSaved
    case sessionNotSaved
    case inboxIsFixed
    case taskGone
    case projectGone
    case workspaceGone
    case changesRefused(count: Int)
    case cacheNotSaved
    case waitingChangesLost
    case signOutFailed
    case updateNeeded
}
