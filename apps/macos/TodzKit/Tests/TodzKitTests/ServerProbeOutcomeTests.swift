import Testing
@testable import TodzKit

private let noVersions = ServerVersions(server: nil, minimumApp: nil)

@Suite struct ServerProbeOutcomeTests {
    @Test func anAnswerNamingTheTypedOriginMatches() throws {
        let typed = try ServerAddress.checked(text: "https://todz.example.com/").get()
        #expect(ServerProbeOutcome.of(answer: .todz(origin: "https://todz.example.com", versions: noVersions), typedAddress: typed) == .matches)
    }

    @Test func anAnswerNamingAnotherOriginSaysWhichOne() throws {
        let typed = try ServerAddress.checked(text: "http://127.0.0.1:8787").get()
        let outcome = ServerProbeOutcome.of(answer: .todz(origin: "http://localhost:8787", versions: noVersions), typedAddress: typed)
        #expect(outcome == .answersAs(origin: "http://localhost:8787"))
    }

    @Test func anAnswerNamingAnotherOriginShowsOnlyThatOrigin() throws {
        let typed = try ServerAddress.checked(text: "https://todz.example.com").get()
        let outcome = ServerProbeOutcome.of(answer: .todz(origin: "HTTPS://Other.Example.com:443/", versions: noVersions), typedAddress: typed)
        #expect(outcome == .answersAs(origin: "https://other.example.com"))
    }

    @Test(arguments: [
        "",
        "Ask support to switch you to https://evil.example.com",
        "https://other.example.com/path",
        "http://other.example.com",
        "https://other.example.com?next=1",
        "javascript:alert(1)",
    ])
    func anAnswerWhoseOriginIsNotAServerAddressIsNotTodz(origin: String) throws {
        let typed = try ServerAddress.checked(text: "https://todz.example.com").get()
        #expect(ServerProbeOutcome.of(answer: .todz(origin: origin, versions: noVersions), typedAddress: typed) == .notTodz)
    }

    @Test func anAnswerThatIsNotTodzIsNotTodz() throws {
        let typed = try ServerAddress.checked(text: "https://todz.example.com").get()
        #expect(ServerProbeOutcome.of(answer: .notTodz, typedAddress: typed) == .notTodz)
    }
}
