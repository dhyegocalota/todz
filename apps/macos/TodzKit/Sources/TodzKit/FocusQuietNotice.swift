public enum FocusQuietNotice: Equatable, Sendable {
    case notQuiet
    case quietNow

    public init(isQuiet: Bool) {
        self = isQuiet ? .quietNow : .notQuiet
    }
}
