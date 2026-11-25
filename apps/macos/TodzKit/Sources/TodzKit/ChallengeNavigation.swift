import Foundation

private let challengePath = "/sign-in/challenge"
private let cloudflareScheme = "https"
private let cloudflareHost = "challenges.cloudflare.com"
private let blankAddresses: Set<String> = ["about:blank", "about:srcdoc"]

public enum ChallengeNavigation {
    public static func isAllowed(url: URL, apiBaseURL: URL) -> Bool {
        let isBlank = blankAddresses.contains(url.absoluteString)
        let isApiOrigin = url.scheme == apiBaseURL.scheme && url.host() == apiBaseURL.host() && url.port == apiBaseURL.port
        let isChallengePage = isApiOrigin && url.path() == challengePath
        let isCloudflare = url.scheme == cloudflareScheme && url.host() == cloudflareHost && url.port == nil
        return isBlank || isChallengePage || isCloudflare
    }
}
