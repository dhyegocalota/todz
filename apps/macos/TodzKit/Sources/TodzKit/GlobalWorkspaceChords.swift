public enum RebindRefusal: Error, Equatable, Sendable {
    case needsTwoModifiers
    case inAppChord
    case notGlobal
    case taken(by: WorkspaceAction)
}

public struct GlobalWorkspaceChords: Equatable, Sendable {
    public let overrides: [WorkspaceAction: KeyChord]

    public init(overrides: [WorkspaceAction: KeyChord] = [:]) {
        self.overrides = overrides
    }

    public func chord(for action: WorkspaceAction) -> KeyChord? {
        guard let defaultChord = action.globalDefaultChord else { return nil }
        guard let chosen = overrides[action] else { return defaultChord }
        return chosen
    }

    public func action(for chord: KeyChord) -> WorkspaceAction? {
        WorkspaceAction.all.first { self.chord(for: $0) == chord }
    }

    public func rebinding(_ action: WorkspaceAction, to chord: KeyChord) -> Result<GlobalWorkspaceChords, RebindRefusal> {
        if let refusal = Self.refusal(for: action, chord: chord) { return .failure(refusal) }
        guard self.chord(for: action) != chord else { return .success(self) }
        if let holder = self.action(for: chord), holder != action { return .failure(.taken(by: holder)) }
        return .success(GlobalWorkspaceChords(overrides: overrides.merging([action: chord]) { _, new in new }))
    }

    static func refusal(for action: WorkspaceAction, chord: KeyChord) -> RebindRefusal? {
        guard action.hasGlobalChord else { return .notGlobal }
        guard chord.modifiers.canBeGlobal else { return .needsTwoModifiers }
        guard !WorkspaceAction.inAppChords.contains(chord) else { return .inAppChord }
        return nil
    }
}
