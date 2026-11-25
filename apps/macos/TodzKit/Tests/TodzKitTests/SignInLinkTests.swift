import Foundation
import Testing
@testable import TodzKit

private let token = String(repeating: "aB3_-", count: 8) + "xyz"
private let turnstileToken = "0.aB3_-" + String(repeating: "x", count: 100)
private let longestTurnstileToken = String(repeating: "a", count: 2048)
private let linksThatAreNotSignInLinks = [
    "todz://sign-in",
    "todz://sign-in?token=\(token)",
    "todz://sign-in?turnstile=\(turnstileToken)",
    "todz://sign-in?token=&turnstile=\(turnstileToken)",
    "todz://sign-in?token=short&turnstile=\(turnstileToken)",
    "todz://sign-in?token=\(token)x&turnstile=\(turnstileToken)",
    "todz://sign-in?token=\(token.dropLast())!&turnstile=\(turnstileToken)",
    "todz://sign-in?token=\(token)&turnstile=",
    "todz://sign-in?token=\(token)&turnstile=bad!token",
    "todz://sign-in?token=\(token)&turnstile=\(longestTurnstileToken)a",
    "todz://sign-in?token=\(token)&token=\(token)&turnstile=\(turnstileToken)",
    "todz://sign-in?token=\(token)&turnstile=\(turnstileToken)&turnstile=\(turnstileToken)",
    "todz://sign-in?token=\(token)&turnstile=\(turnstileToken)&extra=1",
    "todz://sign-in?other=\(token)&turnstile=\(turnstileToken)",
    "todz://sign-in/extra?token=\(token)&turnstile=\(turnstileToken)",
    "todz://sign-in/?token=\(token)&turnstile=\(turnstileToken)",
    "todz://sign-out?token=\(token)&turnstile=\(turnstileToken)",
    "https://sign-in?token=\(token)&turnstile=\(turnstileToken)",
    "todz://today?token=\(token)&turnstile=\(turnstileToken)",
]

private func url(_ text: String) throws -> URL {
    try #require(URL(string: text))
}

@Suite struct SignInLinkTests {
    @Test func aLinkWithAFortyThreeCharacterTokenAndATurnstileTokenIsASignInLink() throws {
        #expect(token.count == 43)
        let link = try SignInLink(url: url("todz://sign-in?token=\(token)&turnstile=\(turnstileToken)"))
        #expect(link?.token == token)
        #expect(link?.turnstileToken == turnstileToken)
    }

    @Test func theQueryItemsMayComeInAnyOrder() throws {
        let link = try SignInLink(url: url("todz://sign-in?turnstile=\(turnstileToken)&token=\(token)"))
        #expect(link?.token == token)
        #expect(link?.turnstileToken == turnstileToken)
    }

    @Test func aTurnstileTokenOfTheLongestLengthIsAccepted() throws {
        let link = try SignInLink(url: url("todz://sign-in?token=\(token)&turnstile=\(longestTurnstileToken)"))
        #expect(link?.turnstileToken == longestTurnstileToken)
    }

    @Test(arguments: linksThatAreNotSignInLinks)
    func anyOtherLinkIsNotASignInLink(text: String) throws {
        #expect(try SignInLink(url: url(text)) == nil)
    }
}

@Suite struct IncomingLinkTests {
    @Test func aSignInLinkRoutesToSignIn() throws {
        let text = "todz://sign-in?token=\(token)&turnstile=\(turnstileToken)"
        let link = try #require(SignInLink(url: url(text)))
        #expect(try IncomingLink(url: url(text)) == .signIn(link))
    }

    @Test func aWidgetLinkRoutesToTheWidget() throws {
        #expect(try IncomingLink(url: url("todz://today")) == .widget(.today))
        #expect(try IncomingLink(url: url("todz://task/acme-inbox/3")) == .widget(.task(TaskKey(projectIdentifier: "acme-inbox", number: 3))))
    }

    @Test(arguments: ["todz://sign-in?token=short", "todz://sign-in", "https://example.com", "todz://nowhere"])
    func anythingElseRoutesNowhere(text: String) throws {
        #expect(try IncomingLink(url: url(text)) == nil)
    }
}
