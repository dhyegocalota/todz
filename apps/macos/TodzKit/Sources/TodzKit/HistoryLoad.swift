public enum HistoryLoad: Equatable, Sendable {
    case loading
    case loaded([HistoryEntry])
    case failed(HistoryFailure)
}
