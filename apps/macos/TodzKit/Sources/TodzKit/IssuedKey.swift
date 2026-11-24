public struct IssuedKey: Decodable, Sendable, Equatable {
    public let key: ProjectKey
    public let secret: String
}

extension IssuedKey {
    public init(from decoder: any Decoder) throws {
        fatalError("IssuedKey is not implemented")
    }
}
