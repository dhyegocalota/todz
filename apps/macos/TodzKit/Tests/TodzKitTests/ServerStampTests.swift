import Testing
@testable import TodzKit

@Suite struct ServerStampTests {
    @Test func theDateIsWhatComesBeforeTheHash() {
        #expect(ServerStamp.date(of: "2026.11.25+3f9c2ab") == "2026.11.25")
    }

    @Test func aStampWithoutAHashIsItsOwnDate() {
        #expect(ServerStamp.date(of: "2026.11.25") == "2026.11.25")
    }
}
