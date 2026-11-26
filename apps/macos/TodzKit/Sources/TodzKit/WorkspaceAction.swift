public enum WorkspaceAction: Hashable, Sendable {
    case number(Int)
    case previous
    case next

    public static let all: [WorkspaceAction] = WorkspaceShortcuts.numbers.map(WorkspaceAction.number) + [.previous, .next]
    public static let inAppChords: [KeyChord] = all.compactMap(\.inAppChord)

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

    // NB ADR 0091: in-app chords are the Workspace menu's keys and are never registered globally.
    public var inAppChord: KeyChord? {
        switch self {
        case let .number(number):
            guard let keyCode = Self.numberKeyCodes[number] else { return nil }
            return KeyChord(keyCode: keyCode, key: String(number), modifiers: [.control])
        case .previous: return Self.previousChord
        case .next: return Self.nextChord
        }
    }

    // NB ADR 0091: global chords are ⌃⌥⌘1…9; previous and next have no global chord.
    public var globalDefaultChord: KeyChord? {
        switch self {
        case let .number(number):
            guard let keyCode = Self.numberKeyCodes[number] else { return nil }
            return KeyChord(keyCode: keyCode, key: String(number), modifiers: WorkspaceShortcuts.globalModifiers)
        case .previous, .next: return nil
        }
    }

    public var hasGlobalChord: Bool {
        globalDefaultChord != nil
    }
}
