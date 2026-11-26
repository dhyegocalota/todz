public enum SymbolicHotKeys {
    public static let domainName = "com.apple.symbolichotkeys"
    public static let entriesKey = "AppleSymbolicHotKeys"

    private static let keyCodeIndex = 1
    private static let modifierIndex = 2
    private static let eventFlagPairs: [(modifier: ChordModifiers, flag: Int)] = [
        (.control, 1 << 18), (.option, 1 << 19), (.shift, 1 << 17), (.command, 1 << 20),
    ]

    public static func holds(_ chord: KeyChord, in entries: [String: Any]) -> Bool {
        entries.values.contains { holds(chord, entry: $0) }
    }

    private static func holds(_ chord: KeyChord, entry: Any) -> Bool {
        guard let entry = entry as? [String: Any], entry["enabled"] as? Bool == true else { return false }
        guard let value = entry["value"] as? [String: Any], let parameters = value["parameters"] as? [Int] else { return false }
        guard parameters.count > modifierIndex else { return false }
        return parameters[keyCodeIndex] == chord.keyCode && modifiers(eventFlags: parameters[modifierIndex]) == chord.modifiers
    }

    private static func modifiers(eventFlags flags: Int) -> ChordModifiers {
        eventFlagPairs
            .filter { flags & $0.flag != 0 }
            .reduce(ChordModifiers(rawValue: 0)) { $0.union($1.modifier) }
    }
}
