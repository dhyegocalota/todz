enum OwnerErrorCode: String, Decodable {
    case invalidRequest = "invalid_request"
    case identityRejected = "identity_rejected"
    case notFound = "not_found"
    case taskNotFound = "task_not_found"
    case inboxIsFixed = "inbox_is_fixed"
    case cursorAhead = "cursor_ahead"
    case ruleViolated = "rule_violated"
    case timeZoneInvalid = "time_zone_invalid"
    case signInUnavailable = "sign_in_unavailable"
    case signInRefused = "sign_in_refused"
    case appTooOld = "app_too_old"
}
