public struct ChordModifiers: OptionSet, Codable, Hashable, Sendable {
    public let rawValue: Int

    public init(rawValue: Int) {
        self.rawValue = rawValue
    }

    public static let control = ChordModifiers(rawValue: 1 << 0)
    public static let option = ChordModifiers(rawValue: 1 << 1)
    public static let shift = ChordModifiers(rawValue: 1 << 2)
    public static let command = ChordModifiers(rawValue: 1 << 3)

    private static let symbols: [(modifier: ChordModifiers, symbol: String)] = [
        (.control, "⌃"), (.option, "⌥"), (.shift, "⇧"), (.command, "⌘"),
    ]

    private static let triggers: ChordModifiers = [.control, .option, .command]
    private static let minimumGlobalTriggers = 2

    public var symbols: String {
        Self.symbols.filter { contains($0.modifier) }.map(\.symbol).joined()
    }

    public var canBeGlobal: Bool {
        intersection(Self.triggers).rawValue.nonzeroBitCount >= Self.minimumGlobalTriggers
    }
}
