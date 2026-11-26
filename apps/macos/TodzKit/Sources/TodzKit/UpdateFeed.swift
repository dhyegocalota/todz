import Foundation

private let feedKey = "SUFeedURL"
private let secureScheme = "https"

public struct UpdateFeed: Equatable, Sendable {
    public let url: URL

    public init?(info: [String: Any]) {
        guard let text = info[feedKey] as? String, let url = URL(string: text), url.scheme == secureScheme, url.host() != nil else { return nil }
        self.url = url
    }
}
