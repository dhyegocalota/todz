import Foundation
import Testing
@testable import TodzKit

private let token = String(repeating: "aB3_-", count: 8) + "xyz"
private let linksThatAreNotSignInLinks = [
    "todz://sign-in",
    "todz://sign-in?token=",
    "todz://sign-in?token=short",
    "todz://sign-in?token=\(token)x",
    "todz://sign-in?token=\(token.dropLast())!",
    "todz://sign-in?token=\(token)&token=\(token)",
    "todz://sign-in?token=\(token)&extra=1",
    "todz://sign-in?other=\(token)",
    "todz://sign-in/extra?token=\(token)",
    "todz://sign-in/?token=\(token)",
    "todz://sign-out?token=\(token)",
    "https://sign-in?token=\(token)",
    "todz://today?token=\(token)",
]

private func url(_ text: String) throws -> URL {
    try #require(URL(string: text))
}

@Suite struct SignInLinkTests {
    @Test func aLinkWithOneFortyThreeCharacterTokenIsASignInLink() throws {
        #expect(token.count == 43)
        #expect(try SignInLink(url: url("todz://sign-in?token=\(token)"))?.token == token)
    }

    @Test(arguments: linksThatAreNotSignInLinks)
    func anyOtherLinkIsNotASignInLink(text: String) throws {
        #expect(try SignInLink(url: url(text)) == nil)
    }
}

@Suite struct IncomingLinkTests {
    @Test func aSignInLinkRoutesToSignIn() throws {
        let link = try #require(SignInLink(url: url("todz://sign-in?token=\(token)")))
        #expect(try IncomingLink(url: url("todz://sign-in?token=\(token)")) == .signIn(link))
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
