import Foundation

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
}

private let errorOfStatus: [ResponseStatus: OwnerAPIError] = [
    .badRequest: .invalidRequest,
    .unauthorized: .unauthorized,
    .notFound: .notFound,
    .unavailable: .signInUnavailable,
]

struct OwnerErrorBody: Decodable {
    let error: OwnerErrorCode
    let number: Int?
    let issue: RuleIssue?
    let index: Int?

    static func failure(status: Int, body: Data) -> OwnerAPIError {
        let codedFailure = (try? OwnerCoding.decoder().decode(OwnerErrorBody.self, from: body))?.failure
        if let codedFailure { return codedFailure }
        let statusFailure = ResponseStatus(rawValue: status).flatMap { errorOfStatus[$0] }
        if let statusFailure { return statusFailure }
        return .unexpected(status: status)
    }

    var failure: OwnerAPIError? {
        switch error {
        case .invalidRequest: .invalidRequest
        case .identityRejected: .identityRejected
        case .notFound: .notFound
        case .taskNotFound: number.map { .taskNotFound(number: $0) }
        case .inboxIsFixed: .inboxIsFixed
        case .cursorAhead: .cursorAhead
        case .ruleViolated: issue.map { .ruleViolated(issue: $0, index: index) }
        case .timeZoneInvalid: .timeZoneInvalid
        case .signInUnavailable: .signInUnavailable
        }
    }
}
