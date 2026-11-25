import Foundation
import Testing
@testable import TodzKit

private let apiBaseURL = URL(string: "https://api.todz.app")!
private let localBaseURL = URL(string: "http://localhost:8787")!
private let mainFrameAllowed = [
    "https://api.todz.app/sign-in/challenge",
    "https://api.todz.app/sign-in/challenge?round=2",
]
private let mainFrameRefused = [
    "https://challenges.cloudflare.com",
    "https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/if/ov2/",
    "about:blank",
    "about:srcdoc",
    "http://challenges.cloudflare.com/turnstile",
    "https://api.todz.app/sign-in",
    "https://api.todz.app/owner/sessions",
    "https://api.todz.app/sign-in/challenge/extra",
    "http://api.todz.app/sign-in/challenge",
    "https://example.com/sign-in/challenge",
    "todz://sign-in?token=a&turnstile=b",
    "todz-dev://sign-in?token=a&turnstile=b",
    "file:///etc/hosts",
    "about:config",
]
private let subFrameAllowed = [
    "https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/if/ov2/av0/rcv/0x4AAAA/normal/auto/",
    "https://challenges.cloudflare.com",
    "about:blank",
    "about:srcdoc",
]
private let subFrameRefused = [
    "https://api.todz.app/sign-in/challenge",
    "http://challenges.cloudflare.com/turnstile",
    "https://challenges.cloudflare.com.example.com/turnstile",
    "https://challenges.cloudflare.com:8443/turnstile",
    "https://api.todz.app/owner/sessions",
    "https://example.com",
    "todz://sign-in?token=a&turnstile=b",
    "todz-dev://sign-in?token=a&turnstile=b",
    "file:///etc/hosts",
    "about:config",
]

private func isAllowed(_ address: String, isMainFrame: Bool, apiBaseURL: URL = apiBaseURL) throws -> Bool {
    let url = try #require(URL(string: address))
    return ChallengeNavigation.isAllowed(url: url, apiBaseURL: apiBaseURL, isMainFrame: isMainFrame)
}

@Suite struct ChallengeNavigationTests {
    @Test(arguments: mainFrameAllowed)
    func theMainFrameMayLoadTheApiChallengePage(address: String) throws {
        #expect(try isAllowed(address, isMainFrame: true))
    }

    @Test(arguments: mainFrameRefused)
    func theMainFrameMayLoadNothingElse(address: String) throws {
        #expect(try isAllowed(address, isMainFrame: true) == false)
    }

    @Test(arguments: subFrameAllowed)
    func aSubFrameMayLoadCloudflareAndBlankPages(address: String) throws {
        #expect(try isAllowed(address, isMainFrame: false))
    }

    @Test(arguments: subFrameRefused)
    func aSubFrameMayLoadNothingElseNotEvenTheChallengePage(address: String) throws {
        #expect(try isAllowed(address, isMainFrame: false) == false)
    }

    @Test func aLocalApiOriginIsAllowedWhenItIsTheConfiguredOne() throws {
        let address = "http://localhost:8787/sign-in/challenge"
        #expect(try isAllowed(address, isMainFrame: true, apiBaseURL: localBaseURL))
        #expect(try isAllowed(address, isMainFrame: true) == false)
    }

    @Test func anotherPortOfTheLocalApiIsRefused() throws {
        #expect(try isAllowed("http://localhost:9999/sign-in/challenge", isMainFrame: true, apiBaseURL: localBaseURL) == false)
    }

    @Test(arguments: [(apiBaseURL, "https://api.todz.app/sign-in/challenge"), (localBaseURL, "http://localhost:8787/sign-in/challenge")])
    func thePageUrlIsTheChallengePageOfTheApiOrigin(base: URL, expected: String) {
        #expect(ChallengeNavigation.pageURL(apiBaseURL: base).absoluteString == expected)
    }

    @Test func thePageUrlIsAllowedInTheMainFrame() {
        let url = ChallengeNavigation.pageURL(apiBaseURL: apiBaseURL)
        #expect(ChallengeNavigation.isAllowed(url: url, apiBaseURL: apiBaseURL, isMainFrame: true))
    }

    @Test func aMessageFromTheMainFrameOfTheApiOriginIsTrusted() {
        #expect(ChallengeNavigation.isTrustedMessage(isMainFrame: true, scheme: "https", host: "api.todz.app", port: 0, apiBaseURL: apiBaseURL))
        #expect(ChallengeNavigation.isTrustedMessage(isMainFrame: true, scheme: "http", host: "localhost", port: 8787, apiBaseURL: localBaseURL))
    }

    @Test(arguments: [
        (true, "http", "api.todz.app", 0),
        (true, "https", "challenges.cloudflare.com", 0),
        (true, "https", "api.todz.app", 8443),
        (true, "https", "api.todz.app.example.com", 0),
        (false, "https", "api.todz.app", 0),
        (false, "https", "challenges.cloudflare.com", 0),
    ])
    func aMessageFromAnotherFrameOrOriginIsNotTrusted(isMainFrame: Bool, scheme: String, host: String, port: Int) {
        #expect(!ChallengeNavigation.isTrustedMessage(isMainFrame: isMainFrame, scheme: scheme, host: host, port: port, apiBaseURL: apiBaseURL))
    }

    @Test func aMessageFromAnotherPortOfALocalApiIsNotTrusted() {
        #expect(!ChallengeNavigation.isTrustedMessage(isMainFrame: true, scheme: "http", host: "localhost", port: 9999, apiBaseURL: localBaseURL))
    }
}
