import Testing
@testable import TodzKit

@Suite struct NameConfirmationTests {
    @Test func theExactNameConfirms() {
        #expect(NameConfirmation.isConfirmed(typed: "Acme", name: "Acme"))
    }

    @Test(arguments: ["", "acme", "Acm", "Acme ", " Acme", "Acme Inc"])
    func anythingElseDoesNotConfirm(typed: String) {
        #expect(!NameConfirmation.isConfirmed(typed: typed, name: "Acme"))
    }

    @Test func anEmptyNameIsNeverConfirmed() {
        #expect(!NameConfirmation.isConfirmed(typed: "", name: ""))
    }
}
