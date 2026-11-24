private let secretPrefix = "todz_"
private let secretCharacters = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
private let malformedSecretDescription = "A key's secret is todz_ followed by base64url characters."

public struct IssuedKey: Decodable, Sendable, Equatable {
    public let key: ProjectKey
    public let secret: String

    enum CodingKeys: String, CodingKey {
        case key
        case secret
    }
}

extension IssuedKey {
    // NB ADR 0034: a secret is todz_ plus base64url, and any other answer is refused before a command quotes it.
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let secret = try container.decode(String.self, forKey: .secret)
        let body = secret.dropFirst(secretPrefix.count)
        let isTodzSecret = secret.hasPrefix(secretPrefix) && !body.isEmpty && body.allSatisfy(secretCharacters.contains)
        guard isTodzSecret else {
            throw DecodingError.dataCorruptedError(forKey: .secret, in: container, debugDescription: malformedSecretDescription)
        }
        self.init(key: try container.decode(ProjectKey.self, forKey: .key), secret: secret)
    }
}
