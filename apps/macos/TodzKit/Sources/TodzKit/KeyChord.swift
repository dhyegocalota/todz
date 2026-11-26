public struct KeyChord: Codable, Hashable, Sendable {
    public let keyCode: Int
    public let key: String
    public let modifiers: ChordModifiers

    public init(keyCode: Int, key: String, modifiers: ChordModifiers) {
        self.keyCode = keyCode
        self.key = key
        self.modifiers = modifiers
    }

    public var label: String {
        modifiers.symbols + key.uppercased()
    }
}
