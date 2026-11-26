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
        nil
    }

    public func action(for chord: KeyChord) -> WorkspaceAction? {
        nil
    }

    public func rebinding(_ action: WorkspaceAction, to chord: KeyChord) -> Result<WorkspaceBindings, RebindRefusal> {
        .success(self)
    }
}
