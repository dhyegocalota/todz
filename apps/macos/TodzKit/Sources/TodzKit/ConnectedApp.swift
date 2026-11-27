import Foundation

public enum ConnectedAppScope: Equatable, Sendable {
    case project(identifier: String, name: String)
    case owner
}

public struct ConnectedApp: Sendable, Equatable, Identifiable {
    public let identifier: String
    public let clientName: String
    public let redirectHost: String
    public let scope: ConnectedAppScope
    public let createdAt: Date
    public let lastUsedAt: Date?

    public var id: String {
        identifier
    }
}

private enum ScopeKind: String, Decodable {
    case project
    case owner
}

extension ConnectedApp: Decodable {
    enum CodingKeys: String, CodingKey {
        case identifier = "id"
        case clientName
        case redirectHost
        case scope
        case projectIdentifier = "projectId"
        case projectName
        case createdAt
        case lastUsedAt
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            identifier: try container.decode(String.self, forKey: .identifier),
            clientName: try container.decode(String.self, forKey: .clientName),
            redirectHost: try container.decode(String.self, forKey: .redirectHost),
            scope: try Self.scope(in: container),
            createdAt: try container.decode(Date.self, forKey: .createdAt),
            lastUsedAt: try container.decodeIfPresent(Date.self, forKey: .lastUsedAt)
        )
    }

    private static func scope(in container: KeyedDecodingContainer<CodingKeys>) throws -> ConnectedAppScope {
        switch try container.decode(ScopeKind.self, forKey: .scope) {
        case .owner:
            return .owner
        case .project:
            return .project(
                identifier: try container.decode(String.self, forKey: .projectIdentifier),
                name: try container.decode(String.self, forKey: .projectName)
            )
        }
    }
}
