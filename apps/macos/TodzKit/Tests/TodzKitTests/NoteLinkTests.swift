import Foundation
import Testing
@testable import TodzKit

private let webLinks = ["https://example.com/plan", "http://localhost:8787/owner", "HTTPS://EXAMPLE.COM"]
private let otherLinks = [
    "vscode://file/etc/hosts",
    "x-apple.systempreferences:com.apple.preference.security",
    "file:///etc/hosts",
    "javascript:alert(1)",
    "mailto:someone@example.com",
]

@Suite struct NoteLinkTests {
    @Test(arguments: webLinks)
    func opensAWebLink(link: String) throws {
        #expect(NoteLink.isOpenable(try #require(URL(string: link))))
    }

    @Test(arguments: otherLinks)
    func discardsEveryOtherScheme(link: String) throws {
        #expect(NoteLink.isOpenable(try #require(URL(string: link))) == false)
    }
}
