public enum AddFieldSubmission: Equatable, Sendable {
    case ignored
    case refused(RuleIssue)
    case accepted(title: String)

    public static func of(title: String) -> AddFieldSubmission {
        let isBlank = title.allSatisfy(\.isWhitespace)
        guard !isBlank else { return .ignored }
        guard let issue = TextCheck.issue(ofTitle: title) else { return .accepted(title: title) }
        return .refused(issue)
    }
}
