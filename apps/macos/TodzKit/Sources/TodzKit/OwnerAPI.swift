import Foundation

private let healthPath = "/health"
private let todzServiceName = "todz"
private let healthBodyLimit = 4_096
private let ownerPath = "/owner"
private let sessionsPath = "/owner/sessions"
private let signInMethodPath = "/owner/sign-in-method"
private let signInLinksPath = "/owner/sign-in-links"
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

private func keysPath(_ projectIdentifier: String) -> String {
    "\(projectPath(projectIdentifier))/keys"
}

private struct HealthBody: Decodable {
    let service: String
    let origin: String?
    let version: String?
    let minimumAppVersion: String?
}

private final class RedirectRefusal: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping @Sendable (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }
}

public protocol OwnerService: Sendable {
    func signInMethod() async throws -> SignInMethod
    func requestSignInLink(email: String, challenge: String, turnstileToken: String, linkScheme: AppLinkScheme) async throws
    func signIn(identityToken: String, linkVerifier: String?, turnstileToken: String?, timeZone: String) async throws -> IssuedSession
    func signOut(session: String) async throws
    func readOwner(session: String) async throws -> Owner
    func updateOwner(session: String, timeZone: String) async throws -> Owner
    func updateAgentNudge(session: String, isEnabled: Bool) async throws -> Owner
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
    func listKeys(session: String, projectIdentifier: String) async throws -> [ProjectKey]
    func issueKey(session: String, projectIdentifier: String) async throws -> IssuedKey
    func revokeKey(session: String, projectIdentifier: String, keyIdentifier: String) async throws
}

public struct OwnerAPI: OwnerService {
    private let baseURL: URL
    private let appVersion: String
    let transport: URLSession

    public init(baseURL: URL, appVersion: String) {
        self.init(baseURL: baseURL, appVersion: appVersion, transport: Self.uncachedTransport())
    }

    public init(baseURL: URL, appVersion: String, transport: URLSession) {
        self.baseURL = baseURL
        self.appVersion = appVersion
        self.transport = transport
    }

    public static let probeTransport = URLSession(configuration: probeConfiguration(deadline: ServerTiming.probeSeconds))

    static func probeConfiguration(deadline: TimeInterval) -> URLSessionConfiguration {
        let configuration = uncachedConfiguration()
        configuration.timeoutIntervalForResource = deadline
        return configuration
    }

    private static func uncachedConfiguration() -> URLSessionConfiguration {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        return configuration
    }

    private static func uncachedTransport() -> URLSession {
        URLSession(configuration: uncachedConfiguration())
    }

    public func health() async throws -> ServerHealthAnswer {
        var request = try OwnerRequest(method: .get, path: healthPath, session: nil).transportRequest(baseURL: baseURL, appVersion: appVersion)
        request.timeoutInterval = ServerTiming.probeSeconds
        let body: Data
        do {
            let (bytes, response) = try await transport.bytes(for: request, delegate: RedirectRefusal())
            defer { bytes.task.cancel() }
            guard let response = response as? HTTPURLResponse, ResponseStatus.successes.contains(response.statusCode) else { return .notTodz }
            body = try await bytes.prefix(healthBodyLimit + 1).reduce(into: Data()) { $0.append($1) }
        } catch is URLError {
            throw OwnerAPIError.unreachable
        }
        guard body.count <= healthBodyLimit else { return .notTodz }
        guard let answer = try? OwnerCoding.decoder().decode(HealthBody.self, from: body), answer.service == todzServiceName else { return .notTodz }
        guard let origin = answer.origin else { return .notTodz }
        return .todz(origin: origin, versions: ServerVersions(server: answer.version, minimumApp: answer.minimumAppVersion))
    }

    public func signInMethod() async throws -> SignInMethod {
        try await answer(SignInMethodAnswer.self, to: OwnerRequest(method: .get, path: signInMethodPath, session: nil)).method
    }

    public func requestSignInLink(email: String, challenge: String, turnstileToken: String, linkScheme: AppLinkScheme) async throws {
        let body = SignInLinkRequestBody(email: email, linkChallenge: challenge, turnstileToken: turnstileToken, appLinkScheme: linkScheme)
        _ = try await send(OwnerRequest(method: .post, path: signInLinksPath, session: nil, body: body))
    }

    public func signIn(identityToken: String, linkVerifier: String?, turnstileToken: String?, timeZone: String) async throws -> IssuedSession {
        let body = SignInBody(identityToken: identityToken, linkVerifier: linkVerifier, turnstileToken: turnstileToken, timeZone: timeZone)
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

    public func updateAgentNudge(session: String, isEnabled: Bool) async throws -> Owner {
        let request = try OwnerRequest(method: .patch, path: ownerPath, session: session, body: AgentNudgeBody(agentNudge: isEnabled))
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

    public func listKeys(session: String, projectIdentifier: String) async throws -> [ProjectKey] {
        try await answer(KeysAnswer.self, to: OwnerRequest(method: .get, path: keysPath(projectIdentifier), session: session)).keys
    }

    public func issueKey(session: String, projectIdentifier: String) async throws -> IssuedKey {
        try await answer(IssuedKey.self, to: OwnerRequest(method: .post, path: keysPath(projectIdentifier), session: session))
    }

    public func revokeKey(session: String, projectIdentifier: String, keyIdentifier: String) async throws {
        let path = "\(keysPath(projectIdentifier))/\(keyIdentifier)"
        _ = try await send(OwnerRequest(method: .delete, path: path, session: session))
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
            return try await transport.data(for: request.transportRequest(baseURL: baseURL, appVersion: appVersion))
        } catch is URLError {
            throw OwnerAPIError.unreachable
        }
    }
}
