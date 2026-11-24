import Foundation

public protocol OwnerService: Sendable {
    func signIn(identityToken: String, timeZone: String) async throws -> IssuedSession
    func signOut(session: String) async throws
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
    private let transport: URLSession

    public init(baseURL: URL, transport: URLSession = .shared) {
        self.baseURL = baseURL
        self.transport = transport
    }

    public func signIn(identityToken: String, timeZone: String) async throws -> IssuedSession {
        fatalError("OwnerAPI is not implemented")
    }

    public func signOut(session: String) async throws {
        fatalError("OwnerAPI is not implemented")
    }

    public func updateOwner(session: String, timeZone: String) async throws -> Owner {
        fatalError("OwnerAPI is not implemented")
    }

    public func listWorkspaces(session: String) async throws -> [Workspace] {
        fatalError("OwnerAPI is not implemented")
    }

    public func createWorkspace(session: String, name: String) async throws -> Workspace {
        fatalError("OwnerAPI is not implemented")
    }

    public func createProject(session: String, workspaceIdentifier: String, name: String) async throws -> Project {
        fatalError("OwnerAPI is not implemented")
    }

    public func renameProject(session: String, projectIdentifier: String, name: String) async throws -> Project {
        fatalError("OwnerAPI is not implemented")
    }

    public func addTasks(session: String, projectIdentifier: String, drafts: [TaskDraft]) async throws -> [AddedTask] {
        fatalError("OwnerAPI is not implemented")
    }

    public func updateTask(session: String, projectIdentifier: String, number: Int, patch: TaskPatch) async throws -> TaskRecord {
        fatalError("OwnerAPI is not implemented")
    }

    public func completeTasks(session: String, projectIdentifier: String, numbers: [Int]) async throws -> [CompletedTask] {
        fatalError("OwnerAPI is not implemented")
    }

    public func reopenTasks(session: String, projectIdentifier: String, numbers: [Int]) async throws -> [ReopenedTask] {
        fatalError("OwnerAPI is not implemented")
    }

    public func readHistory(session: String, projectIdentifier: String, number: Int) async throws -> [HistoryEntry] {
        fatalError("OwnerAPI is not implemented")
    }

    public func readChanges(session: String, projectIdentifier: String, cursor: Int) async throws -> ChangePage {
        fatalError("OwnerAPI is not implemented")
    }
}
