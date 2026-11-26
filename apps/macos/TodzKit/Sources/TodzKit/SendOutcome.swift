enum SendOutcome: Equatable, Sendable {
    case refused
    case unreachable
    case unexpected
    case sessionGone
    case updateNeeded
    case paused

    // NB ADR 0028: a refusal drops the change, unreachable waits, an unexpected failure counts only after an answer since the last, and the third drops it.
    static func of(_ error: any Error) -> SendOutcome {
        guard !(error is CancellationError) else { return .sessionGone }
        guard let failure = error as? OwnerAPIError else { return .unexpected }
        switch failure {
        case .ruleViolated, .taskNotFound, .notFound, .invalidRequest, .inboxIsFixed, .cursorAhead, .timeZoneInvalid, .identityRejected, .fairUseRefused, .limitReached:
            return .refused
        case .unreachable:
            return .unreachable
        case .unexpected, .signInUnavailable, .signInRefused:
            return .unexpected
        case .unauthorized:
            return .sessionGone
        // NB ADR 0069: app_too_old keeps the change and stops the flush, because the server never judged it.
        case .appTooOld:
            return .updateNeeded
        // NB ADR 0088: a daily cap or a suspension keeps the whole queue and pauses sending, because the server judged the account, not the change.
        case .fairUsePaused:
            return .paused
        }
    }
}
