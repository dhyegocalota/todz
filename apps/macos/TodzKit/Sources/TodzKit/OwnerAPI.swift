import Foundation

private let ownerPath = "/owner"
private let sessionsPath = "/owner/sessions"
private let currentSessionPath = "/owner/sessions/current"
private let workspacesPath = "/owner/workspaces"
private let cursorParameter = "cursor"

private func projectsPath(workspaceIdentifier: String) -> String {
    "\(workspacesPath)/\(workspaceIdentifier)/projects"
}

func projectPath(_ projectIdentifier: String) -> String {
    "\(ownerPath)/projects/\(projectIdentifier)"
}

private func tasksPath(_ projectIdentifier: String) -> String {
    "\(projectPath(projectIdentifier))/tasks"
}

private func taskPath(projectIdentifier: String, number: Int) -> String {
    "\(tasksPath(projectIdentifier))/\(number)"
}

public protocol OwnerService: Sendable {
    func signIn(identityToken: String, timeZone: String) async throws -> IssuedSession
    func signOut(session: String) async throws
    func readOwner(session: String) async throws -> Owner
    func updateOwner(session: String, timeZone: String) async throws -> Owner
    func listWorkspaces(session: String) async throws -> [Workspace]
    func createWorkspace(session: String, name: String) async throws -> Workspace
    func createProject(session: String, workspaceIdentifier: String, name: String) async throws -> Project
    func renameProject(session: String, projectIdentifier: String, name: String) async throws -> Project
    func addTasks(session: String, projectIdentifier: String, drafts: [TaskDraft]) async throws -> [AddedTask]
    func updateTask(session: String, projectIdentifier: String, number: Int, patch: TaskPatch) async throws -> TaskRecord
    func completeTasks(session: String, projectIdentifier: String, numbers: [Int]) async throws -> [CompletedTask]
    func reopenTasks(session: String, projectIdentifier: String, numbers: [Int]) async throws -> [ReopenedTask]
    func readHistory(session: String, projectIdentifier: String, number: Int) async throws -> [HistoryEntry]
    func readChanges(session: String, projectIdentifier: String, cursor: Int) async throws -> ChangePage
}

public struct OwnerAPI: OwnerService {
    private let baseURL: URL
    let transport: URLSession

    public init(baseURL: URL) {
        self.init(baseURL: baseURL, transport: Self.uncachedTransport())
    }

    public init(baseURL: URL, transport: URLSession) {
        self.baseURL = baseURL
        self.transport = transport
    }

    private static func uncachedTransport() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: configuration)
    }

    public func signIn(identityToken: String, timeZone: String) async throws -> IssuedSession {
        let body = SignInBody(identityToken: identityToken, timeZone: timeZone)
        return try await answer(IssuedSession.self, to: OwnerRequest(method: .post, path: sessionsPath, session: nil, body: body))
    }

    public func signOut(session: String) async throws {
        _ = try await send(OwnerRequest(method: .delete, path: currentSessionPath, session: session))
    }

    public func readOwner(session: String) async throws -> Owner {
        try await answer(OwnerAnswer.self, to: OwnerRequest(method: .get, path: ownerPath, session: session)).owner
    }

    public func updateOwner(session: String, timeZone: String) async throws -> Owner {
        let request = try OwnerRequest(method: .patch, path: ownerPath, session: session, body: TimeZoneBody(timeZone: timeZone))
        return try await answer(OwnerAnswer.self, to: request).owner
    }

    public func listWorkspaces(session: String) async throws -> [Workspace] {
        try await answer(WorkspacesAnswer.self, to: OwnerRequest(method: .get, path: workspacesPath, session: session)).workspaces
    }

    public func createWorkspace(session: String, name: String) async throws -> Workspace {
        let request = try OwnerRequest(method: .post, path: workspacesPath, session: session, body: NameBody(name: name))
        return try await answer(WorkspaceAnswer.self, to: request).workspace
    }

    public func createProject(session: String, workspaceIdentifier: String, name: String) async throws -> Project {
        let path = projectsPath(workspaceIdentifier: workspaceIdentifier)
        let request = try OwnerRequest(method: .post, path: path, session: session, body: NameBody(name: name))
        return try await answer(ProjectAnswer.self, to: request).project
    }

    public func renameProject(session: String, projectIdentifier: String, name: String) async throws -> Project {
        let request = try OwnerRequest(method: .patch, path: projectPath(projectIdentifier), session: session, body: NameBody(name: name))
        return try await answer(ProjectAnswer.self, to: request).project
    }

    public func addTasks(session: String, projectIdentifier: String, drafts: [TaskDraft]) async throws -> [AddedTask] {
        let request = try OwnerRequest(method: .post, path: tasksPath(projectIdentifier), session: session, body: AddTasksBody(tasks: drafts))
        return try await answer(AddedTasksAnswer.self, to: request).tasks
    }

    public func updateTask(session: String, projectIdentifier: String, number: Int, patch: TaskPatch) async throws -> TaskRecord {
        let path = taskPath(projectIdentifier: projectIdentifier, number: number)
        return try await answer(TaskAnswer.self, to: OwnerRequest(method: .patch, path: path, session: session, body: patch)).task
    }

    public func completeTasks(session: String, projectIdentifier: String, numbers: [Int]) async throws -> [CompletedTask] {
        let path = "\(tasksPath(projectIdentifier))/complete"
        let request = try OwnerRequest(method: .post, path: path, session: session, body: TaskNumbersBody(numbers: numbers))
        return try await answer(CompletedTasksAnswer.self, to: request).tasks
    }

    public func reopenTasks(session: String, projectIdentifier: String, numbers: [Int]) async throws -> [ReopenedTask] {
        let path = "\(tasksPath(projectIdentifier))/reopen"
        let request = try OwnerRequest(method: .post, path: path, session: session, body: TaskNumbersBody(numbers: numbers))
        return try await answer(ReopenedTasksAnswer.self, to: request).tasks
    }

    public func readHistory(session: String, projectIdentifier: String, number: Int) async throws -> [HistoryEntry] {
        let path = "\(taskPath(projectIdentifier: projectIdentifier, number: number))/history"
        return try await answer(HistoryAnswer.self, to: OwnerRequest(method: .get, path: path, session: session)).history
    }

    public func readChanges(session: String, projectIdentifier: String, cursor: Int) async throws -> ChangePage {
        let path = "\(projectPath(projectIdentifier))/changes"
        let queryItems = [URLQueryItem(name: cursorParameter, value: String(cursor))]
        return try await answer(ChangePage.self, to: OwnerRequest(method: .get, path: path, session: session, queryItems: queryItems))
    }

    private func answer<Answer: Decodable>(_ type: Answer.Type, to request: OwnerRequest) async throws -> Answer {
        try OwnerCoding.decoder().decode(Answer.self, from: try await send(request))
    }

    private func send(_ request: OwnerRequest) async throws -> Data {
        let (body, response) = try await exchange(request)
        guard let response = response as? HTTPURLResponse else { throw OwnerAPIError.unreachable }
        guard ResponseStatus.successes.contains(response.statusCode) else {
            throw OwnerErrorBody.failure(status: response.statusCode, body: body)
        }
        return body
    }

    private func exchange(_ request: OwnerRequest) async throws -> (Data, URLResponse) {
        do {
            return try await transport.data(for: request.transportRequest(baseURL: baseURL))
        } catch is URLError {
            throw OwnerAPIError.unreachable
        }
    }
}
