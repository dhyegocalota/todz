public enum ShortcutCompletion: Equatable, Sendable {
    case completed(title: String, isOffline: Bool)
    case alreadyDone(title: String)
    case notFound
    case signedOut
}
