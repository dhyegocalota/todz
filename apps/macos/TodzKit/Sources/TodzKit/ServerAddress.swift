import Foundation

public struct ServerAddress: Equatable, Sendable {
    public let origin: String
    public let authority: String
    public let url: URL

    public static func checked(text: String) -> Result<ServerAddress, ServerAddressIssue> {
        preconditionFailure("ServerAddress.checked is not implemented")
    }
}
