import Testing
@testable import TodzKit

private let identitiesThatPass = ["dhyego", "maria.silva", "walker-2", "a_b", "A9"]
private let identitiesThatFail = ["", "maria silva", "maria@example", "ação", "../x"]

private func letters(_ count: Int) -> String {
    String(repeating: "a", count: count)
}

@Suite struct IdentityFormatTests {
    @Test(arguments: identitiesThatPass)
    func lettersDigitsDotsDashesAndUnderscoresPass(identity: String) {
        #expect(IdentityFormat.isValid(identity))
    }

    @Test(arguments: identitiesThatFail)
    func anythingElseFails(identity: String) {
        #expect(IdentityFormat.isValid(identity) == false)
    }

    @Test func anIdentityAtTheLimitPassesAndOneOverItFails() {
        #expect(IdentityFormat.isValid(letters(IdentityFormat.maxLength)))
        #expect(IdentityFormat.isValid(letters(IdentityFormat.maxLength + 1)) == false)
    }
}
