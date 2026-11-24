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
        }
    }

    var body: String? {
        switch self {
        case .network: ErrorCopy.networkBody
        case .server: ErrorCopy.serverBody
        case .someProjectsFailed, .changeNotSaved, .sessionNotSaved, .inboxIsFixed, .taskGone, .projectGone, .workspaceGone: nil
        }
    }
}
