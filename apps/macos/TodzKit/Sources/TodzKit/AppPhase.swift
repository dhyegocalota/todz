public enum AppPhase: Equatable, Sendable {
    case loading
    case signedOut(notice: SignInNotice?)
    case naming
    case choosing
    case ready
}
