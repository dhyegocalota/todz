import Foundation

private let emptyClientNameDescription = "An agent's client name is empty."

public struct Owner: Codable, Sendable, Equatable {
    public let identifier: String
    public let timeZone: String
    public internal(set) var agentNudge: Bool? = nil
    public internal(set) var dayEmail: Bool? = nil
    public internal(set) var dayEmailMinutes: Int? = nil

    enum CodingKeys: String, CodingKey {
        case identifier = "id"
        case timeZone
        case agentNudge
        case dayEmail
        case dayEmailMinutes
    }
}

public struct Project: Codable, Sendable, Equatable, Hashable {
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

public struct Workspace: Codable, Sendable, Equatable, Hashable {
    public let identifier: String
    public let name: String
    public let createdAt: Date
    public let projects: [Project]
    public let lastActivityAt: Date?

    init(identifier: String, name: String, createdAt: Date, projects: [Project], lastActivityAt: Date? = nil) {
        self.identifier = identifier
        self.name = name
        self.createdAt = createdAt
        self.projects = projects
        self.lastActivityAt = lastActivityAt
    }

    public var projectCount: Int {
        projects.count
    }

    enum CodingKeys: String, CodingKey {
        case identifier = "id"
        case name
        case createdAt
        case lastActivityAt
        case projects
    }
}

public enum ChangeActor: Codable, Sendable, Equatable {
    case owner
    case agent(clientName: String)

    enum CodingKeys: String, CodingKey {
        case kind
        case clientName
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(ActorKind.self, forKey: .kind) {
        case .owner:
            self = .owner
        case .agent:
            self = .agent(clientName: try Self.clientName(in: container))
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .owner:
            try container.encode(ActorKind.owner, forKey: .kind)
        case .agent(let clientName):
            try container.encode(ActorKind.agent, forKey: .kind)
            try container.encode(clientName, forKey: .clientName)
        }
    }

    private static func clientName(in container: KeyedDecodingContainer<CodingKeys>) throws -> String {
        let clientName = try container.decode(String.self, forKey: .clientName)
        guard !clientName.isEmpty else {
            throw DecodingError.dataCorruptedError(forKey: .clientName, in: container, debugDescription: emptyClientNameDescription)
        }
        return clientName
    }
}

public struct TaskRecord: Codable, Sendable, Equatable {
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
    public let deletedNumbers: [Int]
    public let cursor: Int
    public let hasMore: Bool
}

extension ChangePage {
    enum CodingKeys: String, CodingKey {
        case tasks
        case deletedNumbers
        case cursor
        case hasMore
    }

    // NB ADR 0102: a feed without deleted_numbers comes from a server that cannot delete.
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let deletedNumbers = try container.contains(.deletedNumbers) ? container.decode([Int].self, forKey: .deletedNumbers) : []
        self.init(
            tasks: try container.decode([TaskRecord].self, forKey: .tasks),
            deletedNumbers: deletedNumbers,
            cursor: try container.decode(Int.self, forKey: .cursor),
            hasMore: try container.decode(Bool.self, forKey: .hasMore)
        )
    }
}

public struct IssuedSession: Decodable, Sendable, Equatable {
    public let sessionToken: String
    public let owner: Owner
}
