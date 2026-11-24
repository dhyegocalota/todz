public enum OwnerAPIError: Error, Equatable, Sendable {
    case unauthorized
    case identityRejected
    case signInUnavailable
    case signInRefused
    case notFound
    case taskNotFound(number: Int)
    case inboxIsFixed
    case cursorAhead
    case ruleViolated(issue: RuleIssue, index: Int?)
    case timeZoneInvalid
    case invalidRequest
    case unreachable
    case unexpected(status: Int)
}
