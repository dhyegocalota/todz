public enum SignInError: Equatable, Sendable {
    case identityRejected
    case signInUnavailable
    case signInRefused
    case invalidAddress
    case linkRejected
    case linkNotRequested
    case linkRefused
    case appTooOld
    case fairUseRefused(message: String)
    case timeZoneInvalid
    case unreachable
    case unexpected

    init(asking failure: OwnerAPIError) {
        guard failure == .invalidRequest else {
            self.init(failure)
            return
        }
        self = .invalidAddress
    }

    init(_ failure: OwnerAPIError) {
        switch failure {
        case .identityRejected: self = .identityRejected
        case .signInUnavailable: self = .signInUnavailable
        case .signInRefused: self = .signInRefused
        case .appTooOld: self = .appTooOld
        case let .fairUseRefused(message), let .fairUsePaused(message): self = .fairUseRefused(message: message)
        case .timeZoneInvalid: self = .timeZoneInvalid
        case .unreachable: self = .unreachable
        case .unauthorized, .notFound, .taskNotFound, .inboxIsFixed, .cursorAhead, .ruleViolated, .invalidRequest, .limitReached, .unexpected:
            self = .unexpected
        }
    }
}
