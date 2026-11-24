public enum SignInError: Equatable, Sendable {
    case identityRejected
    case signInUnavailable
    case tooManyLinks
    case linkRejected
    case linkNotRequested
    case timeZoneInvalid
    case unreachable
    case unexpected

    init(_ failure: OwnerAPIError) {
        switch failure {
        case .identityRejected: self = .identityRejected
        case .signInUnavailable: self = .signInUnavailable
        case .timeZoneInvalid: self = .timeZoneInvalid
        case .unreachable: self = .unreachable
        case .unauthorized, .notFound, .taskNotFound, .inboxIsFixed, .cursorAhead, .ruleViolated, .invalidRequest, .tooManyLinks, .unexpected:
            self = .unexpected
        }
    }
}
