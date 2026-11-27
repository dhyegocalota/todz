@testable import TodzKit

enum FakeRoute: Hashable, Sendable {
    case signInMethod
    case requestSignInLink
    case signIn
    case signOut
    case readOwner
    case updateOwner
    case updateAgentNudge
    case updateDayEmail
    case updateDayEmailMinutes
    case listWorkspaces
    case createWorkspace
    case renameWorkspace
    case deleteWorkspace
    case createProject
    case renameProject
    case deleteProject
    case addTasks
    case updateTask
    case deleteTask
    case completeTasks
    case reopenTasks
    case readHistory
    case readChanges
    case listConnectedApps
    case disconnectConnectedApp
}

enum FakeCall: Equatable, Sendable {
    case signInMethod
    case requestSignInLink(email: String, challenge: String, turnstileToken: String, linkScheme: AppLinkScheme)
    case signIn(identityToken: String, linkVerifier: String?, turnstileToken: String?, timeZone: String)
    case signOut(session: String)
    case readOwner(session: String)
    case updateOwner(session: String, timeZone: String)
    case updateAgentNudge(session: String, isEnabled: Bool)
    case updateDayEmail(session: String, isEnabled: Bool)
    case updateDayEmailMinutes(session: String, minutes: Int)
    case listWorkspaces(session: String)
    case createWorkspace(session: String, name: String)
    case renameWorkspace(session: String, workspaceIdentifier: String, name: String)
    case deleteWorkspace(session: String, workspaceIdentifier: String)
    case createProject(session: String, workspaceIdentifier: String, name: String)
    case renameProject(session: String, projectIdentifier: String, name: String)
    case deleteProject(session: String, projectIdentifier: String)
    case addTasks(session: String, projectIdentifier: String, drafts: [TaskDraft])
    case updateTask(session: String, projectIdentifier: String, number: Int, patch: TaskPatch)
    case deleteTask(session: String, projectIdentifier: String, number: Int, title: String)
    case completeTasks(session: String, projectIdentifier: String, numbers: [Int])
    case reopenTasks(session: String, projectIdentifier: String, numbers: [Int])
    case readHistory(session: String, projectIdentifier: String, number: Int)
    case readChanges(session: String, projectIdentifier: String, cursor: Int)
    case listConnectedApps(session: String)
    case disconnectConnectedApp(session: String, connectedAppIdentifier: String)

    var route: FakeRoute {
        switch self {
        case .signInMethod: .signInMethod
        case .requestSignInLink: .requestSignInLink
        case .signIn: .signIn
        case .signOut: .signOut
        case .readOwner: .readOwner
        case .updateOwner: .updateOwner
        case .updateAgentNudge: .updateAgentNudge
        case .updateDayEmail: .updateDayEmail
        case .updateDayEmailMinutes: .updateDayEmailMinutes
        case .listWorkspaces: .listWorkspaces
        case .createWorkspace: .createWorkspace
        case .renameWorkspace: .renameWorkspace
        case .deleteWorkspace: .deleteWorkspace
        case .createProject: .createProject
        case .renameProject: .renameProject
        case .deleteProject: .deleteProject
        case .addTasks: .addTasks
        case .updateTask: .updateTask
        case .deleteTask: .deleteTask
        case .completeTasks: .completeTasks
        case .reopenTasks: .reopenTasks
        case .readHistory: .readHistory
        case .readChanges: .readChanges
        case .listConnectedApps: .listConnectedApps
        case .disconnectConnectedApp: .disconnectConnectedApp
        }
    }

    var projectIdentifier: String? {
        switch self {
        case let .renameProject(_, projectIdentifier, _),
            let .deleteProject(_, projectIdentifier),
            let .addTasks(_, projectIdentifier, _),
            let .updateTask(_, projectIdentifier, _, _),
            let .deleteTask(_, projectIdentifier, _, _),
            let .completeTasks(_, projectIdentifier, _),
            let .reopenTasks(_, projectIdentifier, _),
            let .readHistory(_, projectIdentifier, _),
            let .readChanges(_, projectIdentifier, _):
            projectIdentifier
        case .signInMethod, .requestSignInLink, .signIn, .signOut, .readOwner, .updateOwner, .updateAgentNudge, .updateDayEmail, .updateDayEmailMinutes, .listWorkspaces, .createWorkspace, .renameWorkspace, .deleteWorkspace, .createProject,
            .listConnectedApps, .disconnectConnectedApp:
            nil
        }
    }

    var cursor: Int? {
        guard case let .readChanges(_, _, cursor) = self else { return nil }
        return cursor
    }
}
