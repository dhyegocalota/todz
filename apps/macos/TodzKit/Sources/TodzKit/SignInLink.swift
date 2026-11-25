import Foundation

private let linkHost = "sign-in"
private let tokenName = "token"
private let turnstileName = "turnstile"
private let originName = "origin"
private let queryItemCount = 3
private let tokenLength = 43

public struct SignInLink: Equatable, Sendable {
    public let token: String
    public let turnstileToken: String
    public let origin: String

    public init?(url: URL) {
        guard url.scheme == linkScheme, url.host() == linkHost, url.path().isEmpty else { return nil }
        let queryItems = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems
        guard let queryItems, queryItems.count == queryItemCount else { return nil }
        let valuesByName = Dictionary(queryItems.compactMap { item in item.value.map { (item.name, $0) } }, uniquingKeysWith: { first, _ in first })
        guard let token = valuesByName[tokenName], let turnstileToken = valuesByName[turnstileName], valuesByName.count == queryItemCount else { return nil }
        guard let origin = valuesByName[originName], !origin.isEmpty else { return nil }
        let isToken = token.count == tokenLength && token.wholeMatch(of: /[A-Za-z0-9_-]+/) != nil
        guard isToken, ChallengeToken.isWellFormed(turnstileToken) else { return nil }
        self.token = token
        self.turnstileToken = turnstileToken
        self.origin = origin
    }
}
