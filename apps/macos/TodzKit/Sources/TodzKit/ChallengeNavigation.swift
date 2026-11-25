import Foundation

private let challengePath = "/sign-in/challenge"
private let cloudflareScheme = "https"
private let cloudflareHost = "challenges.cloudflare.com"
private let blankAddresses: Set<String> = ["about:blank", "about:srcdoc"]
private let defaultPort = 0

public enum ChallengeNavigation {
    public static func pageURL(apiBaseURL: URL) -> URL {
        apiBaseURL.appending(path: challengePath)
    }

    public static func isTrustedMessage(isMainFrame: Bool, scheme: String, host: String, port: Int, apiBaseURL: URL) -> Bool {
        guard isMainFrame else { return false }
        return scheme == apiBaseURL.scheme && host == apiBaseURL.host() && port == originPort(of: apiBaseURL)
    }

    public static func isAllowed(url: URL, apiBaseURL: URL, isMainFrame: Bool) -> Bool {
        guard isMainFrame else { return isBlank(url) || isCloudflare(url) }
        return isChallengePage(url, apiBaseURL: apiBaseURL)
    }

    private static func originPort(of url: URL) -> Int {
        guard let port = url.port else { return defaultPort }
        return port
    }

    private static func isBlank(_ url: URL) -> Bool {
        blankAddresses.contains(url.absoluteString)
    }

    private static func isCloudflare(_ url: URL) -> Bool {
        url.scheme == cloudflareScheme && url.host() == cloudflareHost && url.port == nil
    }

    private static func isChallengePage(_ url: URL, apiBaseURL: URL) -> Bool {
        let isApiOrigin = url.scheme == apiBaseURL.scheme && url.host() == apiBaseURL.host() && url.port == apiBaseURL.port
        return isApiOrigin && url.path() == challengePath
    }
}
