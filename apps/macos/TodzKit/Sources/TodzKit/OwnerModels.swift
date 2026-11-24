import Foundation

public struct Owner: Decodable, Sendable, Equatable {
    public let identifier: String
    public let timeZone: String

    enum CodingKeys: String, CodingKey {
        case identifier = "id"
        case timeZone
    }
}

public struct Project: Decodable, Sendable, Equatable, Hashable {
    public let identifier: String
    public let name: String
    public let isInbox: Bool
    public let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case identifier = "id"
        case name
        case isInbox
        case createdAt
    }
}

public struct Workspace: Decodable, Sendable, Equatable {
    public let identifier: String
    public let name: String
    public let createdAt: Date
    public let projects: [Project]

    enum CodingKeys: String, CodingKey {
        case identifier = "id"
        case name
        case createdAt
        case projects
    }
}

public struct ChangeActor: Decodable, Sendable, Equatable {
    public let kind: ActorKind
    public let clientName: String?
}

public struct TaskRecord: Decodable, Sendable, Equatable {
    public let number: Int
    public let title: String
    public let notes: String?
    public let dueDate: CalendarDate?
    public let state: TaskState
    public let orderKey: String
    public let idempotencyKey: String?
    public let createdBy: ChangeActor
    public let createdAt: Date
    public let updatedAt: Date
    public let completedAt: Date?
}

public struct HistoryEntry: Decodable, Sendable, Equatable {
    public let at: Date
    public let actor: ChangeActor
    public let action: HistoryAction
    public let fields: [TaskField]
    public let note: String?
}

public struct ChangePage: Decodable, Sendable, Equatable {
    public let tasks: [TaskRecord]
    public let cursor: Int
    public let hasMore: Bool
}

public struct IssuedSession: Decodable, Sendable, Equatable {
    public let sessionToken: String
    public let owner: Owner
}
