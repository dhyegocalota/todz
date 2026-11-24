import Testing
@testable import TodzKit

private let addressesThatPass = ["maria@example.com", "maria.silva+todz@mail.example.com", "a@b.c", "Maria@Example.COM", "o'brien@example.com", "a..b@example.com"]
private let addressesThatFail = [
    "",
    "maria",
    "maria@example",
    "@example.com",
    "maria@.com",
    "maria@example.",
    "maria@@example.com",
    "a@b@example.com",
    "maria silva@example.com",
    "maria@exam ple.com",
    "maria@example.com ",
    "<maria>@example.com",
    "maria@example.com>",
    "maria,joao@example.com",
    "\"maria\"@example.com",
    "maria@example.com\n",
    "mar\u{0}ia@example.com",
    "joão@example.com",
    "maria@exämple.com",
]
private let maxLength = 254

private func address(ofLength length: Int) -> String {
    let domain = "@example.com"
    return String(repeating: "a", count: length - domain.count) + domain
}

@Suite struct EmailAddressFormatTests {
    @Test(arguments: addressesThatPass)
    func anAsciiAddressWithOneAtAndADotAfterItPasses(address: String) {
        #expect(EmailAddressFormat.isValid(address))
    }

    @Test(arguments: addressesThatFail)
    func anythingElseFails(address: String) {
        #expect(EmailAddressFormat.isValid(address) == false)
    }

    @Test func theLongestAllowedAddressPassesAndOneMoreFails() {
        #expect(EmailAddressFormat.isValid(address(ofLength: maxLength)))
        #expect(EmailAddressFormat.isValid(address(ofLength: maxLength + 1)) == false)
    }
}
