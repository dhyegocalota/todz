public enum AddFieldSubmission: Equatable, Sendable {
    case ignored
    case refused(RuleIssue)
    case accepted(title: String)

    public static func of(title: String) -> AddFieldSubmission {
        .ignored
    }
}
