public enum SyncStatus: Equatable, Sendable {
    case online
    case offline(waiting: Int)
}
