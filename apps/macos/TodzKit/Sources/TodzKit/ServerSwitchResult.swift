public enum ServerSwitchResult: Equatable, Sendable {
    case switched
    case busy
    case alreadyInUse
    case eraseFailed
}
