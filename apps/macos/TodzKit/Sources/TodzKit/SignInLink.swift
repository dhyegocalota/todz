import Foundation

private let linkHost = "sign-in"
private let tokenName = "token"
private let tokenLength = 43

public struct SignInLink: Equatable, Sendable {
    public let token: String

    public init?(url: URL) {
        guard url.scheme == linkScheme, url.host() == linkHost, url.path().isEmpty else { return nil }
        let queryItems = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems
        guard let queryItems, queryItems.count == 1, queryItems[0].name == tokenName, let token = queryItems[0].value else { return nil }
        let isToken = token.count == tokenLength && token.wholeMatch(of: /[A-Za-z0-9_-]+/) != nil
        guard isToken else { return nil }
        self.token = token
    }
}
