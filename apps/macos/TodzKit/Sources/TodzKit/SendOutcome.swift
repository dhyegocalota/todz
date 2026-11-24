enum SendOutcome: Equatable, Sendable {
    case refused
    case unreachable
    case unexpected
    case sessionGone

    // NB ADR 0028: a refusal drops the change, unreachable waits, the third unexpected failure drops it as refused.
    static func of(_ error: any Error) -> SendOutcome {
        guard !(error is CancellationError) else { return .sessionGone }
        guard let failure = error as? OwnerAPIError else { return .unexpected }
        switch failure {
        case .ruleViolated, .taskNotFound, .notFound, .invalidRequest, .inboxIsFixed, .cursorAhead, .timeZoneInvalid, .identityRejected:
            return .refused
        case .unreachable:
            return .unreachable
        case .unexpected, .signInUnavailable:
            return .unexpected
        case .unauthorized:
            return .sessionGone
        }
    }
}
