import Foundation
import Testing
@testable import TodzKit

private let apiBaseURL = URL(string: "https://api.todz.app")!
private let localBaseURL = URL(string: "http://localhost:8787")!
private let allowedAddresses = [
    "https://api.todz.app/sign-in/challenge",
    "https://api.todz.app/sign-in/challenge?round=2",
    "https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/if/ov2/av0/rcv/0x4AAAA/normal/auto/",
    "https://challenges.cloudflare.com",
    "about:blank",
    "about:srcdoc",
]
private let refusedAddresses = [
    "http://challenges.cloudflare.com/turnstile",
    "https://challenges.cloudflare.com.example.com/turnstile",
    "https://api.todz.app/sign-in",
    "https://api.todz.app/owner/sessions",
    "https://api.todz.app/sign-in/challenge/extra",
    "http://api.todz.app/sign-in/challenge",
    "https://example.com/sign-in/challenge",
    "https://example.com",
    "todz://sign-in?token=a&turnstile=b",
    "file:///etc/hosts",
    "about:config",
]

@Suite struct ChallengeNavigationTests {
    @Test(arguments: allowedAddresses)
    func theApiChallengePageAndCloudflareAreAllowed(address: String) throws {
        let url = try #require(URL(string: address))
        #expect(ChallengeNavigation.isAllowed(url: url, apiBaseURL: apiBaseURL, isMainFrame: true))
    }

    @Test(arguments: refusedAddresses)
    func everywhereElseIsRefused(address: String) throws {
        let url = try #require(URL(string: address))
        #expect(ChallengeNavigation.isAllowed(url: url, apiBaseURL: apiBaseURL, isMainFrame: true) == false)
    }

    @Test func aLocalApiOriginIsAllowedWhenItIsTheConfiguredOne() throws {
        let url = try #require(URL(string: "http://localhost:8787/sign-in/challenge"))
        #expect(ChallengeNavigation.isAllowed(url: url, apiBaseURL: localBaseURL, isMainFrame: true))
        #expect(ChallengeNavigation.isAllowed(url: url, apiBaseURL: apiBaseURL, isMainFrame: true) == false)
    }

    @Test func anotherPortOfTheLocalApiIsRefused() throws {
        let url = try #require(URL(string: "http://localhost:9999/sign-in/challenge"))
        #expect(ChallengeNavigation.isAllowed(url: url, apiBaseURL: localBaseURL, isMainFrame: true) == false)
    }
}
