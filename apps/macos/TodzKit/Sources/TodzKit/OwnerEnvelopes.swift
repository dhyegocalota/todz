public struct AddedTask: Decodable, Sendable, Equatable {
    public let task: TaskRecord
    public let replayed: Bool
}

public struct CompletedTask: Decodable, Sendable, Equatable {
    public let task: TaskRecord
    public let alreadyDone: Bool
}

public struct ReopenedTask: Decodable, Sendable, Equatable {
    public let task: TaskRecord
    public let alreadyOpen: Bool
}

struct OwnerAnswer: Decodable {
    let owner: Owner
}

struct WorkspacesAnswer: Decodable {
    let workspaces: [Workspace]
}

struct WorkspaceAnswer: Decodable {
    let workspace: Workspace
}

struct ProjectAnswer: Decodable {
    let project: Project
}

struct TaskAnswer: Decodable {
    let task: TaskRecord
}

struct AddedTasksAnswer: Decodable {
    let tasks: [AddedTask]
}

struct CompletedTasksAnswer: Decodable {
    let tasks: [CompletedTask]
}

struct ReopenedTasksAnswer: Decodable {
    let tasks: [ReopenedTask]
}

struct HistoryAnswer: Decodable {
    let history: [HistoryEntry]
}

struct KeysAnswer: Decodable {
    let keys: [ProjectKey]
}

struct SignInMethodAnswer: Decodable {
    let method: SignInMethod
}
