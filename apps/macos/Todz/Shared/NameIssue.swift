import TodzKit

enum NameIssue {
    static func shown(name: String, serverIssue: RuleIssue?) -> RuleIssue? {
        let localIssue = TextCheck.issue(ofName: name)
        guard localIssue != .nameTooLong else { return localIssue }
        return serverIssue
    }

    static func disabledReason(name: String) -> String? {
        TextCheck.issue(ofName: name)?.copy
    }
}
