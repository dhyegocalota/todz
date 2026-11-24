@testable import TodzKit

enum FakeRoute: Hashable, Sendable {
    case signInMethod
    case requestSignInLink
    case signIn
    case signOut
    case readOwner
    case updateOwner
    case listWorkspaces
    case createWorkspace
    case createProject
    case renameProject
    case addTasks
    case updateTask
    case completeTasks
    case reopenTasks
    case readHistory
    case readChanges
    case listKeys
    case issueKey
    case revokeKey
}

enum FakeCall: Equatable, Sendable {
    case signInMethod
    case requestSignInLink(email: String, challenge: String, turnstileToken: String)
    case signIn(identityToken: String, linkVerifier: String?, turnstileToken: String?, timeZone: String)
    case signOut(session: String)
    case readOwner(session: String)
    case updateOwner(session: String, timeZone: String)
    case listWorkspaces(session: String)
    case createWorkspace(session: String, name: String)
    case createProject(session: String, workspaceIdentifier: String, name: String)
    case renameProject(session: String, projectIdentifier: String, name: String)
    case addTasks(session: String, projectIdentifier: String, drafts: [TaskDraft])
    case updateTask(session: String, projectIdentifier: String, number: Int, patch: TaskPatch)
    case completeTasks(session: String, projectIdentifier: String, numbers: [Int])
    case reopenTasks(session: String, projectIdentifier: String, numbers: [Int])
    case readHistory(session: String, projectIdentifier: String, number: Int)
    case readChanges(session: String, projectIdentifier: String, cursor: Int)
    case listKeys(session: String, projectIdentifier: String)
    case issueKey(session: String, projectIdentifier: String)
    case revokeKey(session: String, projectIdentifier: String, keyIdentifier: String)

    var route: FakeRoute {
        switch self {
        case .signInMethod: .signInMethod
        case .requestSignInLink: .requestSignInLink
        case .signIn: .signIn
        case .signOut: .signOut
        case .readOwner: .readOwner
        case .updateOwner: .updateOwner
        case .listWorkspaces: .listWorkspaces
        case .createWorkspace: .createWorkspace
        case .createProject: .createProject
        case .renameProject: .renameProject
        case .addTasks: .addTasks
        case .updateTask: .updateTask
        case .completeTasks: .completeTasks
        case .reopenTasks: .reopenTasks
        case .readHistory: .readHistory
        case .readChanges: .readChanges
        case .listKeys: .listKeys
        case .issueKey: .issueKey
        case .revokeKey: .revokeKey
        }
    }

    var projectIdentifier: String? {
        switch self {
        case let .renameProject(_, projectIdentifier, _),
            let .addTasks(_, projectIdentifier, _),
            let .updateTask(_, projectIdentifier, _, _),
            let .completeTasks(_, projectIdentifier, _),
            let .reopenTasks(_, projectIdentifier, _),
            let .readHistory(_, projectIdentifier, _),
            let .readChanges(_, projectIdentifier, _),
            let .listKeys(_, projectIdentifier),
            let .issueKey(_, projectIdentifier),
            let .revokeKey(_, projectIdentifier, _):
            projectIdentifier
        case .signInMethod, .requestSignInLink, .signIn, .signOut, .readOwner, .updateOwner, .listWorkspaces, .createWorkspace, .createProject:
            nil
        }
    }

    var cursor: Int? {
        guard case let .readChanges(_, _, cursor) = self else { return nil }
        return cursor
    }
}
