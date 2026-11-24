private let maxLength = 254
private let printableAscii: ClosedRange<UInt8> = 0x21...0x7E
private let refusedCharacters: Set<Character> = ["<", ">", ",", "\""]

public enum EmailAddressFormat {
    public static func isValid(_ address: String) -> Bool {
        let isAllowedText = address.count <= maxLength && address.allSatisfy(isAllowed)
        return isAllowedText && address.wholeMatch(of: /[^@]+@[^@]+\.[^@]+/) != nil
    }

    private static func isAllowed(_ character: Character) -> Bool {
        guard let code = character.asciiValue else { return false }
        return printableAscii.contains(code) && !refusedCharacters.contains(character)
    }
}
