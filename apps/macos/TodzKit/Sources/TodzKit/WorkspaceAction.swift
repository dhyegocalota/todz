public enum WorkspaceAction: Hashable, Sendable {
    case number(Int)
    case previous
    case next

    public static let all: [WorkspaceAction] = WorkspaceShortcuts.numbers.map(WorkspaceAction.number) + [.previous, .next]

    private static let numberPrefix = "number"
    private static let previousName = "previous"
    private static let nextName = "next"

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

    public var defaultChord: KeyChord? {
        nil
    }
}
