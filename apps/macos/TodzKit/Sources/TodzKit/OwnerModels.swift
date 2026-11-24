import Foundation

private let emptyClientNameDescription = "An agent's client name is empty."

public struct Owner: Codable, Sendable, Equatable {
    public let identifier: String
    public let timeZone: String

    enum CodingKeys: String, CodingKey {
        case identifier = "id"
        case timeZone
    }

    public func encode(to encoder: any Encoder) throws {
        fatalError("Owner.encode is not implemented")
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

    public func encode(to encoder: any Encoder) throws {
        fatalError("Project.encode is not implemented")
    }
}

public struct Workspace: Codable, Sendable, Equatable {
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

    public func encode(to encoder: any Encoder) throws {
        fatalError("Workspace.encode is not implemented")
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
        fatalError("ChangeActor.encode is not implemented")
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

    public func encode(to encoder: any Encoder) throws {
        fatalError("TaskRecord.encode is not implemented")
    }
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
