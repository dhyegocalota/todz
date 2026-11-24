private let maxLength = 254

enum EmailAddressFormat {
    static func isValid(_ address: String) -> Bool {
        address.count <= maxLength && address.wholeMatch(of: /[^@\s]+@[^@\s]+\.[^@\s]+/) != nil
    }
}
