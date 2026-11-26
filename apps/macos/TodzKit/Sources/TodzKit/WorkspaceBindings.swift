public enum RebindRefusal: Error, Equatable, Sendable {
    case needsModifier
    case taken(by: WorkspaceAction)
}

public struct WorkspaceBindings: Equatable, Sendable {
    public let overrides: [WorkspaceAction: KeyChord]

    public init(overrides: [WorkspaceAction: KeyChord] = [:]) {
        self.overrides = overrides
    }

    public func chord(for action: WorkspaceAction) -> KeyChord? {
        guard let chosen = overrides[action] else { return action.defaultChord }
        return chosen
    }

    public func action(for chord: KeyChord) -> WorkspaceAction? {
        WorkspaceAction.all.first { self.chord(for: $0) == chord }
    }

    public func rebinding(_ action: WorkspaceAction, to chord: KeyChord) -> Result<WorkspaceBindings, RebindRefusal> {
        guard chord.modifiers.canTrigger else { return .failure(.needsModifier) }
        guard self.chord(for: action) != chord else { return .success(self) }
        if let holder = self.action(for: chord), holder != action { return .failure(.taken(by: holder)) }
        return .success(WorkspaceBindings(overrides: overrides.merging([action: chord]) { _, new in new }))
    }
}
