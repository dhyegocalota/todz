public enum FieldState: Sendable, Equatable {
    case rest
    case focused
    case invalid
    case disabled
    case busy

    // NB ADR 0104: busy outranks disabled, disabled outranks invalid, invalid outranks focus, so a refocused invalid field keeps its ring.
    public static func of(isFocused: Bool, hasIssue: Bool, isDisabled: Bool, isBusy: Bool) -> FieldState {
        if isBusy { return .busy }
        if isDisabled { return .disabled }
        if hasIssue { return .invalid }
        if isFocused { return .focused }
        return .rest
    }
}
