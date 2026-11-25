public enum ServerHealthAnswer: Equatable, Sendable {
    case todz(origin: String, versions: ServerVersions)
    case notTodz
}
