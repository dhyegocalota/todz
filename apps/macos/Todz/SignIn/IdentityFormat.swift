enum IdentityFormat {
    static let maxLength = 64

    static func isValid(_ identity: String) -> Bool {
        let isWithinLength = identity.count <= maxLength
        return isWithinLength && identity.wholeMatch(of: /[A-Za-z0-9._-]+/) != nil
    }
}
