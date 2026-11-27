import Foundation

public enum ConnectedScope: Equatable, Sendable {
    case account
    case workspace(identifier: String, name: String)
    case project(identifier: String, name: String, workspaceIdentifier: String, workspaceName: String)

    public var workspaceIdentifier: String? {
        switch self {
        case .account: nil
        case let .workspace(identifier, _): identifier
        case let .project(_, _, workspaceIdentifier, _): workspaceIdentifier
        }
    }
}

private enum ScopeKind: String, Codable {
    case account
    case workspace
    case project
}

extension ConnectedScope: Codable {
    enum CodingKeys: String, CodingKey {
        case kind
        case workspaceIdentifier = "workspaceId"
        case workspaceName
        case projectIdentifier = "projectId"
        case projectName
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(ScopeKind.self, forKey: .kind) {
        case .account:
            self = .account
        case .workspace:
            self = .workspace(
                identifier: try container.decode(String.self, forKey: .workspaceIdentifier),
                name: try container.decode(String.self, forKey: .workspaceName)
            )
        case .project:
            self = .project(
                identifier: try container.decode(String.self, forKey: .projectIdentifier),
                name: try container.decode(String.self, forKey: .projectName),
                workspaceIdentifier: try container.decode(String.self, forKey: .workspaceIdentifier),
                workspaceName: try container.decode(String.self, forKey: .workspaceName)
            )
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .account:
            try container.encode(ScopeKind.account, forKey: .kind)
        case let .workspace(identifier, _):
            try container.encode(ScopeKind.workspace, forKey: .kind)
            try container.encode(identifier, forKey: .workspaceIdentifier)
        case let .project(identifier, _, _, _):
            try container.encode(ScopeKind.project, forKey: .kind)
            try container.encode(identifier, forKey: .projectIdentifier)
        }
    }
}

public struct ConnectedApp: Sendable, Equatable, Identifiable, Decodable {
    public let identifier: String
    public let clientName: String
    public let redirectHost: String
    public let scopes: [ConnectedScope]
    public let createdAt: Date
    public let lastUsedAt: Date

    public var id: String {
        identifier
    }

    enum CodingKeys: String, CodingKey {
        case identifier = "id"
        case clientName
        case redirectHost
        case scopes
        case createdAt
        case lastUsedAt
    }
}
