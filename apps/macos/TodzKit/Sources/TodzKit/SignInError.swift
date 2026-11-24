public enum SignInError: Equatable, Sendable {
    case identityRejected
    case signInUnavailable
    case tooManyLinks
    case tooManyRequests
    case invalidAddress
    case linkRejected
    case linkNotRequested
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
        case .tooManyLinks: self = .tooManyLinks
        case .tooManyRequests: self = .unexpected
        case .timeZoneInvalid: self = .timeZoneInvalid
        case .unreachable: self = .unreachable
        case .unauthorized, .notFound, .taskNotFound, .inboxIsFixed, .cursorAhead, .ruleViolated, .invalidRequest, .unexpected:
            self = .unexpected
        }
    }
}
