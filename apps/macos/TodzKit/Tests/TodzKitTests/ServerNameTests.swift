import Testing
@testable import TodzKit

@Suite struct ServerNameTests {
    @Test(arguments: [
        ("https://api.todz.app", "api.todz.app"),
        ("http://localhost:8787", "localhost:8787"),
        ("http://[::1]:8787", "[::1]:8787"),
        ("https://todz.example.com:443", "todz.example.com"),
    ])
    func aNameIsTheHostWithItsPortWhenThePortIsNotTheDefault(text: String, name: String) throws {
        let address = try ServerAddress.checked(text: text).get()
        #expect(ServerName.of(address: address) == name)
    }
}
