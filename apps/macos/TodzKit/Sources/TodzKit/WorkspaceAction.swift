public enum WorkspaceAction: Hashable, Sendable {
    case number(Int)
    case previous
    case next

    public static let all: [WorkspaceAction] = WorkspaceShortcuts.numbers.map(WorkspaceAction.number) + [.previous, .next]

    private static let numberPrefix = "number"
    private static let previousName = "previous"
    private static let nextName = "next"
    private static let numberKeyCodes = [1: 18, 2: 19, 3: 20, 4: 21, 5: 23, 6: 22, 7: 26, 8: 28, 9: 25]
    private static let stepModifiers: ChordModifiers = [.control, .command]
    private static let previousChord = KeyChord(keyCode: 33, key: "[", modifiers: stepModifiers)
    private static let nextChord = KeyChord(keyCode: 30, key: "]", modifiers: stepModifiers)

    public init?(storageName: String) {
        guard let action = Self.all.first(where: { $0.storageName == storageName }) else { return nil }
        self = action
    }

    public var storageName: String {
        switch self {
        case let .number(number): "\(Self.numberPrefix)\(number)"
        case .previous: Self.previousName
        case .next: Self.nextName
        }
    }

    // NB ADR 0079: ⌃1…⌃9 pick workspaces 1…9, ⌃⌘[ and ⌃⌘] step; a workspace beyond the ninth has no chord.
    public var defaultChord: KeyChord? {
        switch self {
        case let .number(number):
            guard let keyCode = Self.numberKeyCodes[number] else { return nil }
            return KeyChord(keyCode: keyCode, key: String(number), modifiers: [.control])
        case .previous: return Self.previousChord
        case .next: return Self.nextChord
        }
    }
}
