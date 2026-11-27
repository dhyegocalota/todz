import Foundation

private struct NotImplemented: Error {}

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

extension ConnectedApp: Decodable {
    public init(from decoder: any Decoder) throws {
        throw NotImplemented()
    }
}
