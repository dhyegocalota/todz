import Foundation
import Testing
@testable import TodzKit

private let token = String(repeating: "aB3_-", count: 8) + "xyz"
private let turnstileToken = "0.aB3_-" + String(repeating: "x", count: 100)
private let longestTurnstileToken = String(repeating: "a", count: 2048)
private let origin = "https://api.todz.app"
private let encodedOrigin = "https%3A%2F%2Fapi.todz.app"
private let linksThatAreNotSignInLinks = [
    "todz://sign-in",
    "todz://sign-in?token=\(token)&origin=\(origin)",
    "todz://sign-in?turnstile=\(turnstileToken)&origin=\(origin)",
    "todz://sign-in?token=\(token)&turnstile=\(turnstileToken)",
    "todz://sign-in?token=\(token)&turnstile=\(turnstileToken)&origin=",
    "todz://sign-in?token=\(token)&turnstile=\(turnstileToken)&origin=\(origin)&origin=\(origin)",
    "todz://sign-in?token=&turnstile=\(turnstileToken)&origin=\(origin)",
    "todz://sign-in?token=short&turnstile=\(turnstileToken)&origin=\(origin)",
    "todz://sign-in?token=\(token)x&turnstile=\(turnstileToken)&origin=\(origin)",
    "todz://sign-in?token=\(token.dropLast())!&turnstile=\(turnstileToken)&origin=\(origin)",
    "todz://sign-in?token=\(token)&turnstile=&origin=\(origin)",
    "todz://sign-in?token=\(token)&turnstile=bad!token&origin=\(origin)",
    "todz://sign-in?token=\(token)&turnstile=\(longestTurnstileToken)a&origin=\(origin)",
    "todz://sign-in?token=\(token)&token=\(token)&turnstile=\(turnstileToken)&origin=\(origin)",
    "todz://sign-in?token=\(token)&turnstile=\(turnstileToken)&turnstile=\(turnstileToken)&origin=\(origin)",
    "todz://sign-in?token=\(token)&turnstile=\(turnstileToken)&origin=\(origin)&extra=1",
    "todz://sign-in?other=\(token)&turnstile=\(turnstileToken)&origin=\(origin)",
    "todz://sign-in/extra?token=\(token)&turnstile=\(turnstileToken)&origin=\(origin)",
    "todz://sign-in/?token=\(token)&turnstile=\(turnstileToken)&origin=\(origin)",
    "todz://sign-out?token=\(token)&turnstile=\(turnstileToken)&origin=\(origin)",
    "https://sign-in?token=\(token)&turnstile=\(turnstileToken)&origin=\(origin)",
    "todz://today?token=\(token)&turnstile=\(turnstileToken)&origin=\(origin)",
]

private func url(_ text: String) throws -> URL {
    try #require(URL(string: text))
}

@Suite struct SignInLinkTests {
    @Test func aLinkWithAFortyThreeCharacterTokenATurnstileTokenAndTheOriginOfItsPageIsASignInLink() throws {
        #expect(token.count == 43)
        let link = try SignInLink(url: url("todz://sign-in?token=\(token)&turnstile=\(turnstileToken)&origin=\(encodedOrigin)"), scheme: .release)
        #expect(link?.token == token)
        #expect(link?.turnstileToken == turnstileToken)
        #expect(link?.origin == origin)
    }

    @Test func theQueryItemsMayComeInAnyOrder() throws {
        let link = try SignInLink(url: url("todz://sign-in?origin=\(encodedOrigin)&turnstile=\(turnstileToken)&token=\(token)"), scheme: .release)
        #expect(link?.token == token)
        #expect(link?.turnstileToken == turnstileToken)
        #expect(link?.origin == origin)
    }

    @Test func aTurnstileTokenOfTheLongestLengthIsAccepted() throws {
        let link = try SignInLink(url: url("todz://sign-in?token=\(token)&turnstile=\(longestTurnstileToken)&origin=\(encodedOrigin)"), scheme: .release)
        #expect(link?.turnstileToken == longestTurnstileToken)
    }

    @Test func aDebugLinkIsASignInLinkOfTheDebugApp() throws {
        let link = try SignInLink(url: url("todz-dev://sign-in?token=\(token)&turnstile=\(turnstileToken)&origin=\(encodedOrigin)"), scheme: .debug)
        #expect(link?.token == token)
    }

    @Test func aReleaseLinkIsNotASignInLinkOfTheDebugApp() throws {
        #expect(try SignInLink(url: url("todz://sign-in?token=\(token)&turnstile=\(turnstileToken)&origin=\(encodedOrigin)"), scheme: .debug) == nil)
    }

    @Test func aDebugLinkIsNotASignInLinkOfTheReleaseApp() throws {
        #expect(try SignInLink(url: url("todz-dev://sign-in?token=\(token)&turnstile=\(turnstileToken)&origin=\(encodedOrigin)"), scheme: .release) == nil)
    }

    @Test(arguments: linksThatAreNotSignInLinks)
    func anyOtherLinkIsNotASignInLink(text: String) throws {
        #expect(try SignInLink(url: url(text), scheme: .release) == nil)
    }
}

@Suite struct IncomingLinkTests {
    @Test func aSignInLinkRoutesToSignIn() throws {
        let text = "todz://sign-in?token=\(token)&turnstile=\(turnstileToken)&origin=\(encodedOrigin)"
        let link = try #require(SignInLink(url: url(text), scheme: .release))
        #expect(try IncomingLink(url: url(text), scheme: .release) == .signIn(link))
    }

    @Test func aWidgetLinkRoutesToTheWidget() throws {
        #expect(try IncomingLink(url: url("todz://today"), scheme: .release) == .widget(.today))
        #expect(try IncomingLink(url: url("todz://task/acme-inbox/3"), scheme: .release) == .widget(.task(TaskKey(projectIdentifier: "acme-inbox", number: 3))))
    }

    @Test(arguments: ["todz://sign-in?token=short", "todz://sign-in", "https://example.com", "todz://nowhere"])
    func anythingElseRoutesNowhere(text: String) throws {
        #expect(try IncomingLink(url: url(text), scheme: .release) == nil)
    }
}
