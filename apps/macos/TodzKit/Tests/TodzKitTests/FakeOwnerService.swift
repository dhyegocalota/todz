import Foundation
@testable import TodzKit

private let tickSeconds: TimeInterval = 1
private let inboxName = "Inbox"
private let keyHintLength = 4

let compatibleStamp = "2026.11.25+3f9c2ab"

struct UndecodableAnswer: Error {}

struct StatusFailure: Sendable {
    let status: Int
    let body: String
}

@MainActor final class FakeOwnerService: OwnerService {
    var calls: [FakeCall] = []
    var failures: [FakeRoute: OwnerAPIError] = [:]
    var undecodableRoutes: Set<FakeRoute> = []
    var statusFailures: [FakeRoute: StatusFailure] = [:]
    var isReplayingAdds = false
    var projectFailures: [String: OwnerAPIError] = [:]
    var changeScripts: [String: [Result<ChangePage, OwnerAPIError>]] = [:]
    var onCall: ((FakeCall) -> Void)?
    var healthAnswer = FakeOwnerService.compatibleHealth
    var pageSize = 50
    var issuedSession = IssuedSession(
        sessionToken: UUID().uuidString,
        owner: Owner(identifier: UUID().uuidString, timeZone: "America/Sao_Paulo")
    )
    var signInMethodAnswer = SignInMethod.identity
    var workspaces: [Workspace] = []
    var tasksOfProject: [String: [TaskRecord]] = [:]
    var history: [HistoryEntry] = []
    var keysOfProject: [String: [ProjectKey]] = [:]
    private(set) var issuedKeyCount = 0
    var clock = fixedInstant
    private var suspendedRoutes: Set<FakeRoute> = []
    private var heldCalls: [FakeRoute: [CheckedContinuation<Void, Never>]] = [:]
    private var waiters: [HeldCallWaiter] = []

    static let compatibleHealth: Result<ServerHealthAnswer, OwnerAPIError> = .success(
        .todz(origin: harnessDefaultServer, versions: ServerVersions(server: compatibleStamp, minimumApp: OwnerFixtures.appVersion))
    )

    func health() async throws -> ServerHealthAnswer {
        try healthAnswer.get()
    }

    func routes() -> [FakeRoute] {
        calls.map(\.route)
    }

    func signInMethod() async throws -> SignInMethod {
        try await record(.signInMethod)
        return signInMethodAnswer
    }

    func requestSignInLink(email: String, challenge: String, turnstileToken: String, linkScheme: AppLinkScheme) async throws {
        try await record(.requestSignInLink(email: email, challenge: challenge, turnstileToken: turnstileToken, linkScheme: linkScheme))
    }

    func signIn(identityToken: String, linkVerifier: String?, turnstileToken: String?, timeZone: String) async throws -> IssuedSession {
        try await record(.signIn(identityToken: identityToken, linkVerifier: linkVerifier, turnstileToken: turnstileToken, timeZone: timeZone))
        return issuedSession
    }

    func signOut(session: String) async throws {
        try await record(.signOut(session: session))
    }

    func readOwner(session: String) async throws -> Owner {
        try await record(.readOwner(session: session))
        return issuedSession.owner
    }

    func updateOwner(session: String, timeZone: String) async throws -> Owner {
        try await record(.updateOwner(session: session, timeZone: timeZone))
        let issued = issuedSession.owner
        return Owner(identifier: issued.identifier, timeZone: timeZone, agentNudge: issued.agentNudge, dayEmail: issued.dayEmail, dayEmailMinutes: issued.dayEmailMinutes)
    }

    func updateAgentNudge(session: String, isEnabled: Bool) async throws -> Owner {
        try await record(.updateAgentNudge(session: session, isEnabled: isEnabled))
        return revisedOwner { $0.agentNudge = isEnabled }
    }

    func updateDayEmail(session: String, isEnabled: Bool) async throws -> Owner {
        try await record(.updateDayEmail(session: session, isEnabled: isEnabled))
        return revisedOwner { $0.dayEmail = isEnabled }
    }

    func updateDayEmailMinutes(session: String, minutes: Int) async throws -> Owner {
        try await record(.updateDayEmailMinutes(session: session, minutes: minutes))
        return revisedOwner { $0.dayEmailMinutes = minutes }
    }

    func listWorkspaces(session: String) async throws -> [Workspace] {
        try await record(.listWorkspaces(session: session))
        return workspaces
    }

    func createWorkspace(session: String, name: String) async throws -> Workspace {
        try await record(.createWorkspace(session: session, name: name))
        let inbox = Project(identifier: UUID().uuidString, name: inboxName, isInbox: true, createdAt: tick())
        let workspace = Workspace(identifier: UUID().uuidString, name: name, createdAt: clock, projects: [inbox])
        workspaces.append(workspace)
        return workspace
    }

    func renameWorkspace(session: String, workspaceIdentifier: String, name: String) async throws -> Workspace {
        try await record(.renameWorkspace(session: session, workspaceIdentifier: workspaceIdentifier, name: name))
        guard let index = workspaces.firstIndex(where: { $0.identifier == workspaceIdentifier }) else { throw OwnerAPIError.notFound }
        let workspace = workspaces[index]
        let renamed = Workspace(identifier: workspace.identifier, name: name, createdAt: workspace.createdAt, projects: workspace.projects)
        workspaces[index] = renamed
        return renamed
    }

    func deleteWorkspace(session: String, workspaceIdentifier: String) async throws {
        try await record(.deleteWorkspace(session: session, workspaceIdentifier: workspaceIdentifier))
        guard workspaces.contains(where: { $0.identifier == workspaceIdentifier }) else { throw OwnerAPIError.notFound }
        workspaces.removeAll { $0.identifier == workspaceIdentifier }
    }

    func createProject(session: String, workspaceIdentifier: String, name: String) async throws -> Project {
        try await record(.createProject(session: session, workspaceIdentifier: workspaceIdentifier, name: name))
        return Project(identifier: "\(workspaceIdentifier)-\(name)", name: name, isInbox: false, createdAt: tick())
    }

    func renameProject(session: String, projectIdentifier: String, name: String) async throws -> Project {
        try await record(.renameProject(session: session, projectIdentifier: projectIdentifier, name: name))
        let project = workspaces.flatMap(\.projects).first { $0.identifier == projectIdentifier }
        guard let project else { throw OwnerAPIError.notFound }
        return Project(identifier: project.identifier, name: name, isInbox: project.isInbox, createdAt: project.createdAt)
    }

    func deleteProject(session: String, projectIdentifier: String) async throws {
        try await record(.deleteProject(session: session, projectIdentifier: projectIdentifier))
        guard workspaces.flatMap(\.projects).contains(where: { $0.identifier == projectIdentifier }) else { throw OwnerAPIError.notFound }
        workspaces = workspaces.map { workspace in
            let projects = workspace.projects.filter { $0.identifier != projectIdentifier }
            return Workspace(identifier: workspace.identifier, name: workspace.name, createdAt: workspace.createdAt, projects: projects)
        }
    }

    func addTasks(session: String, projectIdentifier: String, drafts: [TaskDraft]) async throws -> [AddedTask] {
        try await record(.addTasks(session: session, projectIdentifier: projectIdentifier, drafts: drafts))
        let held = tasksOfProject[projectIdentifier, default: []]
        let added = drafts.enumerated().map { offset, draft in
            var task = MutableTask(number: held.count + offset + 1, title: draft.title, dueDate: draft.dueDate, updatedAt: tick())
            task.notes = draft.notes
            task.idempotencyKey = draft.idempotencyKey
            return task.record
        }
        tasksOfProject[projectIdentifier] = held + added
        return added.map { AddedTask(task: $0, replayed: isReplayingAdds) }
    }

    func updateTask(session: String, projectIdentifier: String, number: Int, patch: TaskPatch) async throws -> TaskRecord {
        try await record(.updateTask(session: session, projectIdentifier: projectIdentifier, number: number, patch: patch))
        return try revise(projectIdentifier: projectIdentifier, number: number) { task in
            switch patch {
            case let .title(title): task.title = title
            case let .notes(notes): task.notes = notes
            case let .dueDate(dueDate): task.dueDate = dueDate
            case .placement: task.orderKey += "V"
            }
        }
    }

    func completeTasks(session: String, projectIdentifier: String, numbers: [Int]) async throws -> [CompletedTask] {
        try await record(.completeTasks(session: session, projectIdentifier: projectIdentifier, numbers: numbers))
        return try numbers.map { number in
            let task = try revise(projectIdentifier: projectIdentifier, number: number) { task in
                task.state = .done
                task.completedAt = task.updatedAt
            }
            return CompletedTask(task: task, alreadyDone: false)
        }
    }

    func reopenTasks(session: String, projectIdentifier: String, numbers: [Int]) async throws -> [ReopenedTask] {
        try await record(.reopenTasks(session: session, projectIdentifier: projectIdentifier, numbers: numbers))
        return try numbers.map { number in
            let task = try revise(projectIdentifier: projectIdentifier, number: number) { task in
                task.state = .open
                task.completedAt = nil
            }
            return ReopenedTask(task: task, alreadyOpen: false)
        }
    }

    func readHistory(session: String, projectIdentifier: String, number: Int) async throws -> [HistoryEntry] {
        try await record(.readHistory(session: session, projectIdentifier: projectIdentifier, number: number))
        return history
    }

    func readChanges(session: String, projectIdentifier: String, cursor: Int) async throws -> ChangePage {
        try await record(.readChanges(session: session, projectIdentifier: projectIdentifier, cursor: cursor))
        let script = changeScripts[projectIdentifier, default: []]
        guard let scripted = script.first else { return page(projectIdentifier: projectIdentifier, cursor: cursor) }
        changeScripts[projectIdentifier] = Array(script.dropFirst())
        return try scripted.get()
    }

    func listKeys(session: String, projectIdentifier: String) async throws -> [ProjectKey] {
        try await record(.listKeys(session: session, projectIdentifier: projectIdentifier))
        return keysOfProject[projectIdentifier, default: []]
    }

    func issueKey(session: String, projectIdentifier: String) async throws -> IssuedKey {
        try await record(.issueKey(session: session, projectIdentifier: projectIdentifier))
        let issued = nextIssuedKey()
        keysOfProject[projectIdentifier, default: []].append(issued.key)
        return issued
    }

    func revokeKey(session: String, projectIdentifier: String, keyIdentifier: String) async throws {
        try await record(.revokeKey(session: session, projectIdentifier: projectIdentifier, keyIdentifier: keyIdentifier))
        let isListed = keysOfProject[projectIdentifier, default: []].contains { $0.identifier == keyIdentifier }
        guard isListed else { throw OwnerAPIError.notFound }
        keysOfProject[projectIdentifier]?.removeAll { $0.identifier == keyIdentifier }
    }

    func nextIssuedKey() -> IssuedKey {
        let identifier = nextKeyIdentifier()
        issuedKeyCount += 1
        let secret = "todz_fake-secret-\(issuedKeyCount)"
        let key = ProjectKey(identifier: identifier, hint: String(secret.suffix(keyHintLength)), createdAt: tick())
        return IssuedKey(key: key, secret: secret)
    }

    func nextKeyIdentifier() -> String {
        "project-key-\(issuedKeyCount + 1)"
    }

    private func revisedOwner(_ revision: (inout Owner) -> Void) -> Owner {
        var owner = issuedSession.owner
        revision(&owner)
        return owner
    }

    private func page(projectIdentifier: String, cursor: Int) -> ChangePage {
        let tasks = tasksOfProject[projectIdentifier, default: []]
        let pageTasks = Array(tasks.dropFirst(cursor).prefix(pageSize))
        let nextCursor = cursor + pageTasks.count
        return ChangePage(tasks: pageTasks, deletedNumbers: [], cursor: nextCursor, hasMore: nextCursor < tasks.count)
    }

    func suspend(_ route: FakeRoute) {
        suspendedRoutes.insert(route)
    }

    func unsuspend(_ route: FakeRoute) {
        suspendedRoutes.remove(route)
    }

    func held(_ route: FakeRoute, count: Int = 1) async {
        guard heldCalls[route, default: []].count < count else { return }
        await withCheckedContinuation { waiters.append(HeldCallWaiter(route: route, count: count, continuation: $0)) }
    }

    func resume(_ route: FakeRoute) {
        guard let oldest = heldCalls[route]?.first else { return }
        heldCalls[route]?.removeFirst()
        oldest.resume()
    }

    private func hold(_ route: FakeRoute) async {
        await withCheckedContinuation { continuation in
            heldCalls[route, default: []].append(continuation)
            let heldCount = heldCalls[route, default: []].count
            let isAnswered: (HeldCallWaiter) -> Bool = { $0.route == route && $0.count <= heldCount }
            let answered = waiters.filter(isAnswered)
            waiters.removeAll(where: isAnswered)
            answered.forEach { $0.continuation.resume() }
        }
    }

    private func record(_ call: FakeCall) async throws {
        calls.append(call)
        onCall?(call)
        if suspendedRoutes.contains(call.route) { await hold(call.route) }
        if let failure = failures[call.route] { throw failure }
        if undecodableRoutes.contains(call.route) { throw UndecodableAnswer() }
        if let failure = statusFailures[call.route] { throw OwnerErrorBody.failure(status: failure.status, body: Data(failure.body.utf8)) }
        guard let projectIdentifier = call.projectIdentifier else { return }
        if let failure = projectFailures[projectIdentifier] { throw failure }
    }

    private func revise(projectIdentifier: String, number: Int, change: (inout MutableTask) -> Void) throws -> TaskRecord {
        let tasks = tasksOfProject[projectIdentifier, default: []]
        guard let index = tasks.firstIndex(where: { $0.number == number }) else { throw OwnerAPIError.taskNotFound(number: number) }
        var task = MutableTask(tasks[index])
        task.updatedAt = tick()
        change(&task)
        tasksOfProject[projectIdentifier]?[index] = task.record
        return task.record
    }

    private func tick() -> Date {
        clock = clock.addingTimeInterval(tickSeconds)
        return clock
    }
}
