import Foundation
@testable import TodzKit

private let tickSeconds: TimeInterval = 1
private let inboxName = "Inbox"

@MainActor final class FakeOwnerService: OwnerService {
    var calls: [FakeCall] = []
    var failures: [FakeRoute: OwnerAPIError] = [:]
    var projectFailures: [String: OwnerAPIError] = [:]
    var changeScripts: [String: [Result<ChangePage, OwnerAPIError>]] = [:]
    var onCall: ((FakeCall) -> Void)?
    var pageSize = 50
    var issuedSession = IssuedSession(
        sessionToken: UUID().uuidString,
        owner: Owner(identifier: UUID().uuidString, timeZone: "America/Sao_Paulo")
    )
    var workspaces: [Workspace] = []
    var tasksOfProject: [String: [TaskRecord]] = [:]
    var history: [HistoryEntry] = []
    var clock = fixedInstant

    func routes() -> [FakeRoute] {
        calls.map(\.route)
    }

    func signIn(identityToken: String, timeZone: String) async throws -> IssuedSession {
        try record(.signIn(identityToken: identityToken, timeZone: timeZone))
        return issuedSession
    }

    func signOut(session: String) async throws {
        try record(.signOut(session: session))
    }

    func updateOwner(session: String, timeZone: String) async throws -> Owner {
        try record(.updateOwner(session: session, timeZone: timeZone))
        return Owner(identifier: issuedSession.owner.identifier, timeZone: timeZone)
    }

    func listWorkspaces(session: String) async throws -> [Workspace] {
        try record(.listWorkspaces(session: session))
        return workspaces
    }

    func createWorkspace(session: String, name: String) async throws -> Workspace {
        try record(.createWorkspace(session: session, name: name))
        let inbox = Project(identifier: UUID().uuidString, name: inboxName, isInbox: true, createdAt: tick())
        let workspace = Workspace(identifier: UUID().uuidString, name: name, createdAt: clock, projects: [inbox])
        workspaces.append(workspace)
        return workspace
    }

    func createProject(session: String, workspaceIdentifier: String, name: String) async throws -> Project {
        try record(.createProject(session: session, workspaceIdentifier: workspaceIdentifier, name: name))
        return Project(identifier: UUID().uuidString, name: name, isInbox: false, createdAt: tick())
    }

    func renameProject(session: String, projectIdentifier: String, name: String) async throws -> Project {
        try record(.renameProject(session: session, projectIdentifier: projectIdentifier, name: name))
        let project = workspaces.flatMap(\.projects).first { $0.identifier == projectIdentifier }
        guard let project else { throw OwnerAPIError.notFound }
        return Project(identifier: project.identifier, name: name, isInbox: project.isInbox, createdAt: project.createdAt)
    }

    func addTasks(session: String, projectIdentifier: String, drafts: [TaskDraft]) async throws -> [AddedTask] {
        try record(.addTasks(session: session, projectIdentifier: projectIdentifier, drafts: drafts))
        let held = tasksOfProject[projectIdentifier, default: []]
        let added = drafts.enumerated().map { offset, draft in
            var task = MutableTask(number: held.count + offset + 1, title: draft.title, dueDate: draft.dueDate, updatedAt: tick())
            task.notes = draft.notes
            task.idempotencyKey = draft.idempotencyKey
            return task.record
        }
        tasksOfProject[projectIdentifier] = held + added
        return added.map { AddedTask(task: $0, replayed: false) }
    }

    func updateTask(session: String, projectIdentifier: String, number: Int, patch: TaskPatch) async throws -> TaskRecord {
        try record(.updateTask(session: session, projectIdentifier: projectIdentifier, number: number, patch: patch))
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
        try record(.completeTasks(session: session, projectIdentifier: projectIdentifier, numbers: numbers))
        return try numbers.map { number in
            let task = try revise(projectIdentifier: projectIdentifier, number: number) { task in
                task.state = .done
                task.completedAt = task.updatedAt
            }
            return CompletedTask(task: task, alreadyDone: false)
        }
    }

    func reopenTasks(session: String, projectIdentifier: String, numbers: [Int]) async throws -> [ReopenedTask] {
        try record(.reopenTasks(session: session, projectIdentifier: projectIdentifier, numbers: numbers))
        return try numbers.map { number in
            let task = try revise(projectIdentifier: projectIdentifier, number: number) { task in
                task.state = .open
                task.completedAt = nil
            }
            return ReopenedTask(task: task, alreadyOpen: false)
        }
    }

    func readHistory(session: String, projectIdentifier: String, number: Int) async throws -> [HistoryEntry] {
        try record(.readHistory(session: session, projectIdentifier: projectIdentifier, number: number))
        return history
    }

    func readChanges(session: String, projectIdentifier: String, cursor: Int) async throws -> ChangePage {
        try record(.readChanges(session: session, projectIdentifier: projectIdentifier, cursor: cursor))
        let script = changeScripts[projectIdentifier, default: []]
        guard let scripted = script.first else { return page(projectIdentifier: projectIdentifier, cursor: cursor) }
        changeScripts[projectIdentifier] = Array(script.dropFirst())
        return try scripted.get()
    }

    private func page(projectIdentifier: String, cursor: Int) -> ChangePage {
        let tasks = tasksOfProject[projectIdentifier, default: []]
        let pageTasks = Array(tasks.dropFirst(cursor).prefix(pageSize))
        let nextCursor = cursor + pageTasks.count
        return ChangePage(tasks: pageTasks, cursor: nextCursor, hasMore: nextCursor < tasks.count)
    }

    private func record(_ call: FakeCall) throws {
        calls.append(call)
        onCall?(call)
        if let failure = failures[call.route] { throw failure }
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
