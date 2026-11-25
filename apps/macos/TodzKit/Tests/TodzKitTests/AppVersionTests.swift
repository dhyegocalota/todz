import Testing
@testable import TodzKit

private let shortVersionKey = "CFBundleShortVersionString"

@Suite struct AppVersionTests {
    @Test func theKeyNamesTheVersion() {
        #expect(AppVersion.of(info: [shortVersionKey: "0.2.0"]) == "0.2.0")
    }

    @Test func aBundleWithoutTheKeyHasNoVersion() {
        #expect(AppVersion.of(info: [:]) == nil)
    }

    @Test func aKeyThatIsNotTextHasNoVersion() {
        #expect(AppVersion.of(info: [shortVersionKey: 2]) == nil)
    }
}
