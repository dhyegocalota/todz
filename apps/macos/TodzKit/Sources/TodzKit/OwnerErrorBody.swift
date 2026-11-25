import Foundation

// NB ADR 0028: a bare status is never a refusal; only a todz error body names one.
private let errorOfStatus: [ResponseStatus: OwnerAPIError] = [
    .unauthorized: .unauthorized,
    .unavailable: .signInUnavailable,
]

struct OwnerErrorBody: Decodable {
    let error: OwnerErrorCode
    let number: Int?
    let issue: RuleIssue?
    let index: Int?
    let minimumAppVersion: String?

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
        case .signInRefused: .signInRefused
        case .appTooOld: minimumAppVersion.map { .appTooOld(minimum: $0) }
        }
    }
}
