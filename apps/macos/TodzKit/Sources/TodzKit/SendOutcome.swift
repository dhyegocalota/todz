enum SendOutcome: Equatable, Sendable {
    case refused
    case unreachable
    case unexpected
    case sessionGone

    // NB ADR 0028: a refusal drops the change, unreachable waits, an unexpected failure counts only after an answer since the last, and the third drops it.
    static func of(_ error: any Error) -> SendOutcome {
        guard !(error is CancellationError) else { return .sessionGone }
        guard let failure = error as? OwnerAPIError else { return .unexpected }
        switch failure {
        case .ruleViolated, .taskNotFound, .notFound, .invalidRequest, .inboxIsFixed, .cursorAhead, .timeZoneInvalid, .identityRejected:
            return .refused
        case .unreachable:
            return .unreachable
        case .unexpected, .signInUnavailable, .signInRefused:
            return .unexpected
        case .unauthorized, .appTooOld:
            return .sessionGone
        }
    }
}
