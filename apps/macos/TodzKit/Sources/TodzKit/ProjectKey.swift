import Foundation

public struct ProjectKey: Codable, Sendable, Equatable, Identifiable {
    public let identifier: String
    public let hint: String
    public let createdAt: Date

    public var id: String {
        identifier
    }
}

extension ProjectKey {
    public init(from decoder: any Decoder) throws {
        fatalError("ProjectKey is not implemented")
    }

    public func encode(to encoder: any Encoder) throws {
        fatalError("ProjectKey is not implemented")
    }
}
