import Testing
@testable import TodzKit

@Suite struct UpdateUserAgentTests {
    @Test func theTextNamesTheAppTheUpdaterAndTheSystemMajorVersionOnly() {
        #expect(UpdateUserAgent.text(appVersion: "0.2.1", sparkleVersion: "2.6.4", macosMajor: 15) == "Todz/0.2.1 Sparkle/2.6.4 macOS/15")
    }
}
