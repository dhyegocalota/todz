import TodzKit

extension AppBanner {
    var title: String {
        switch self {
        case .network: ErrorCopy.networkTitle
        case .server: ErrorCopy.serverTitle
        case .someProjectsFailed: ErrorCopy.someProjectsFailed
        case .changeNotSaved: ErrorCopy.changeNotSaved
        case .sessionNotSaved: ErrorCopy.sessionNotSaved
        case .inboxIsFixed: ErrorCopy.inboxIsFixed
        case .taskGone: ErrorCopy.taskGone
        case .projectGone: ErrorCopy.projectGone
        case .workspaceGone: ErrorCopy.workspaceGone
        case let .changesRefused(count): Self.refusedTitle(count: count)
        case .cacheNotSaved: ErrorCopy.cacheNotSaved
        case .waitingChangesLost: ErrorCopy.waitingChangesLost
        }
    }

    var body: String? {
        switch self {
        case .network: ErrorCopy.networkBody
        case .server: ErrorCopy.serverBody
        case .changesRefused: ErrorCopy.changeNotSavedBody
        case .someProjectsFailed, .changeNotSaved, .sessionNotSaved, .inboxIsFixed, .taskGone, .projectGone, .workspaceGone, .cacheNotSaved,
            .waitingChangesLost:
            nil
        }
    }

    private static func refusedTitle(count: Int) -> String {
        guard count > 1 else { return ErrorCopy.changeNotSaved }
        return ErrorCopy.changesNotSaved(count: count)
    }
}
