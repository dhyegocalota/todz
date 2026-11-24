public struct IssuedKey: Decodable, Sendable, Equatable {
    public let key: ProjectKey
    public let secret: String
}
