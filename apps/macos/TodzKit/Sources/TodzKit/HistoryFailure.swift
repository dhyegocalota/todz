public enum HistoryFailure: Equatable, Sendable {
    case offline
    case failed

    public static func of(isOffline: Bool) -> HistoryFailure {
        fatalError("HistoryFailure is not implemented")
    }
}
