import Testing
@testable import TodzKit

private let app = "0.2.0"
private let currentStamp = "2026.11.25+3f9c2ab"
private let currentServer = ServerVersions(server: currentStamp, minimumApp: "0.2.0")

@Suite struct VersionCompatibilityTests {
    @Test func aServerThatAcceptsTheAppAndIsNewEnoughIsCompatible() {
        #expect(VersionCompatibility.of(app: app, server: currentServer, refusal: nil) == .compatible(app: app, server: currentStamp))
    }

    @Test func aServerWhoseMinimumIsAboveTheAppNeedsAnUpdate() {
        let server = ServerVersions(server: currentStamp, minimumApp: "0.3.0")
        #expect(VersionCompatibility.of(app: app, server: server, refusal: nil) == .updateNeeded(app: app, server: currentStamp, minimum: "0.3.0"))
    }

    @Test func aRecordedRefusalWinsOverACompatibleAnswer() {
        #expect(VersionCompatibility.of(app: app, server: currentServer, refusal: AppRefusal(minimum: "0.3.0")) == .updateNeeded(app: app, server: currentStamp, minimum: "0.3.0"))
    }

    @Test func aRecordedRefusalWithoutAnAnswerNeedsAnUpdate() {
        #expect(VersionCompatibility.of(app: app, server: nil, refusal: AppRefusal(minimum: "0.3.0")) == .updateNeeded(app: app, server: nil, minimum: "0.3.0"))
    }

    @Test func aRefusalThatNamesNoMinimumNeedsAnUpdate() {
        #expect(VersionCompatibility.of(app: app, server: currentServer, refusal: AppRefusal(minimum: nil)) == .updateNeeded(app: app, server: currentStamp, minimum: nil))
    }

    @Test func aServerOlderThanTheOneTheAppExpectsIsBehind() {
        let server = ServerVersions(server: "2026.11.20+aaaaaaa", minimumApp: "0.2.0")
        #expect(VersionCompatibility.of(app: app, server: server, refusal: nil) == .serverBehind(app: app, server: "2026.11.20+aaaaaaa"))
    }

    @Test func aServerThatStatesNoVersionIsBehind() {
        let server = ServerVersions(server: nil, minimumApp: nil)
        #expect(VersionCompatibility.of(app: app, server: server, refusal: nil) == .serverBehind(app: app, server: nil))
    }

    @Test func aServerThatHasNotAnsweredIsUnknown() {
        #expect(VersionCompatibility.of(app: app, server: nil, refusal: nil) == .serverUnknown(app: app))
    }

    @Test func aServerOfTheSameDayOrLaterIsCompatible() {
        let sameDay = ServerVersions(server: "2026.11.25+bbbbbbb", minimumApp: "0.2.0")
        let later = ServerVersions(server: "2026.12.01+ccccccc", minimumApp: "0.2.0")
        #expect(VersionCompatibility.of(app: app, server: sameDay, refusal: nil) == .compatible(app: app, server: "2026.11.25+bbbbbbb"))
        #expect(VersionCompatibility.of(app: app, server: later, refusal: nil) == .compatible(app: app, server: "2026.12.01+ccccccc"))
    }

    @Test func versionsCompareAsNumbersNotAsText() {
        let server = ServerVersions(server: currentStamp, minimumApp: "0.9.0")
        #expect(VersionCompatibility.of(app: "0.10.0", server: server, refusal: nil) == .compatible(app: "0.10.0", server: currentStamp))
    }

    @Test(arguments: ["x", "99999999999999999999.0", "0.2.0-beta", "", "1..2"])
    func aMinimumThatDoesNotParseIsIgnoredWithoutACrash(minimum: String) {
        let server = ServerVersions(server: currentStamp, minimumApp: minimum)
        #expect(VersionCompatibility.of(app: app, server: server, refusal: nil) == .compatible(app: app, server: currentStamp))
    }

    @Test(arguments: ["99999999999999999999.1.1+abc", "2026.11.xx", "+abc", ""])
    func aServerStampThatOverflowsOrIsMalformedIsBehindWithoutACrash(stamp: String) {
        let server = ServerVersions(server: stamp, minimumApp: "0.2.0")
        #expect(VersionCompatibility.of(app: app, server: server, refusal: nil) == .serverBehind(app: app, server: nil))
    }

    @Test func aServerStampThatDoesNotParseIsBehindWithoutACrash() {
        let server = ServerVersions(server: "banana", minimumApp: "0.2.0")
        #expect(VersionCompatibility.of(app: app, server: server, refusal: nil) == .serverBehind(app: app, server: nil))
    }
}
