import Testing
@testable import TodzKit

private let malformedIdentifiers = ["abc", "abc/", "/3", "abc/0", "abc/-1", "abc/x", "abc/1.5", ""]
private let identifiersThatDoNotRoundTrip = ["abc/+3", "abc/03", "abc/ 3"]

@Suite struct TaskKeyShortcutTests {
    @Test func aKeyIsItsProjectAndNumberAndBack() {
        let key = TaskKey(projectIdentifier: "acme-inbox", number: 12)
        #expect(key.shortcutIdentifier == "acme-inbox/12")
        #expect(TaskKey(shortcutIdentifier: "acme-inbox/12") == key)
    }

    @Test func aProjectIdentifierHoldingDashesRoundTrips() {
        let key = TaskKey(projectIdentifier: "3f2a-91bc-acme-order", number: 7)
        #expect(TaskKey(shortcutIdentifier: key.shortcutIdentifier) == key)
    }

    @Test(arguments: malformedIdentifiers)
    func aMalformedIdentifierIsNoKey(identifier: String) {
        #expect(TaskKey(shortcutIdentifier: identifier) == nil)
    }

    @Test func theLastSeparatorSplitsTheNumberFromTheProject() {
        #expect(TaskKey(shortcutIdentifier: "a/b/3") == TaskKey(projectIdentifier: "a/b", number: 3))
    }

    @Test(arguments: identifiersThatDoNotRoundTrip)
    func aNumberThatDoesNotRoundTripIsNoKey(identifier: String) {
        #expect(TaskKey(shortcutIdentifier: identifier) == nil)
    }
}
