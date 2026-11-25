public enum FocusQuietNotice: Equatable, Sendable {
    case notQuiet
    case quietNow

    public init(isQuiet: Bool) {
        fatalError("FocusQuietNotice is not implemented")
    }
}
