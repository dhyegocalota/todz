import Foundation

public struct PendingSignInLink: Codable, Equatable, Sendable {
    public let email: String
    public let verifier: String
    public let expiresAt: Date

    public init(email: String, verifier: String, expiresAt: Date) {
        self.email = email
        self.verifier = verifier
        self.expiresAt = expiresAt
    }
}
