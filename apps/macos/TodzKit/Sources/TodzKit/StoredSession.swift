public struct StoredSession: Codable, Equatable, Sendable {
    public let secret: String
    public let origin: String

    public init(secret: String, origin: String) {
        self.secret = secret
        self.origin = origin
    }
}
