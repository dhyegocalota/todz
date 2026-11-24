import Foundation

public struct ProjectKey: Codable, Sendable, Equatable, Identifiable {
    public let identifier: String
    public let hint: String
    public let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case identifier = "id"
        case hint
        case createdAt
    }

    public var id: String {
        identifier
    }
}
