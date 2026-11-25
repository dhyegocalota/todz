import Testing
@testable import TodzKit

private let accepted = [
    (" https://Todz.Example.com/ ", "https://todz.example.com"),
    ("https://todz.example.com", "https://todz.example.com"),
    ("HTTP://LOCALHOST:8787", "http://localhost:8787"),
    ("http://localhost:8787", "http://localhost:8787"),
    ("http://127.0.0.1:8787", "http://127.0.0.1:8787"),
    ("http://[::1]:8787", "http://[::1]:8787"),
    ("https://todz.example.com:443", "https://todz.example.com"),
    ("http://localhost:80", "http://localhost"),
    ("https://todz.example.com:8443", "https://todz.example.com:8443"),
]

private let refused: [(String, ServerAddressIssue)] = [
    ("http://localhost.evil.example", .insecureRemoteHost),
    ("http://127.0.0.2:8787", .insecureRemoteHost),
    ("http://todz.example.com", .insecureRemoteHost),
    ("todz.example.com", .missingScheme),
    ("ftp://todz.example.com", .unsupportedScheme),
    ("https://", .missingHost),
    ("https://todz.example.com/?a=1", .hasQuery),
    ("https://todz.example.com/#top", .hasFragment),
    ("https://user:secret@todz.example.com", .hasCredentials),
    ("https://example.com/todz", .hasPath),
    ("   ", .invalid),
    ("not a url", .invalid),
    ("https://evil%2Eexample.com", .invalid),
    ("https://ex%41mple.com", .invalid),
    ("http://local%68ost:8787", .invalid),
    ("https://exämple.com", .invalid),
]

@Suite struct ServerAddressTests {
    @Test(arguments: accepted)
    func anAcceptedAddressKeepsOnlyItsOrigin(text: String, origin: String) throws {
        let address = try ServerAddress.checked(text: text).get()
        #expect(address.origin == origin)
        #expect(address.url.absoluteString == origin)
    }

    @Test(arguments: refused)
    func aRefusedAddressNamesItsIssue(text: String, issue: ServerAddressIssue) {
        #expect(ServerAddress.checked(text: text) == .failure(issue))
    }

    @Test func theSameServerTypedTwoWaysIsOneAddress() throws {
        let plain = try ServerAddress.checked(text: "https://todz.example.com").get()
        let typed = try ServerAddress.checked(text: " HTTPS://todz.example.com:443/ ").get()
        #expect(plain == typed)
    }
}
