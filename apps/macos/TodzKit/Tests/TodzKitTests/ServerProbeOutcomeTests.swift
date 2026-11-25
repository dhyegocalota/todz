import Testing
@testable import TodzKit

@Suite struct ServerProbeOutcomeTests {
    @Test func anAnswerNamingTheTypedOriginMatches() throws {
        let typed = try ServerAddress.checked(text: "https://todz.example.com/").get()
        #expect(ServerProbeOutcome.of(answer: .todz(origin: "https://todz.example.com"), typedAddress: typed) == .matches)
    }

    @Test func anAnswerNamingAnotherOriginSaysWhichOne() throws {
        let typed = try ServerAddress.checked(text: "http://127.0.0.1:8787").get()
        let outcome = ServerProbeOutcome.of(answer: .todz(origin: "http://localhost:8787"), typedAddress: typed)
        #expect(outcome == .answersAs(origin: "http://localhost:8787"))
    }

    @Test func anAnswerThatIsNotTodzIsNotTodz() throws {
        let typed = try ServerAddress.checked(text: "https://todz.example.com").get()
        #expect(ServerProbeOutcome.of(answer: .notTodz, typedAddress: typed) == .notTodz)
    }
}
