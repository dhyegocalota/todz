private let singleSpace = " "
private let windowsLineBreak = "\r\n"
private let lineFeed = "\n"

public enum TextCheck {
    public static func issue(ofTitle title: String) -> RuleIssue? {
        singleLineIssue(of: title, maxLength: TaskLimits.titleMaxLength, empty: .titleEmpty, tooLong: .titleTooLong)
    }

    public static func issue(ofName name: String) -> RuleIssue? {
        singleLineIssue(of: name, maxLength: TaskLimits.nameMaxLength, empty: .nameEmpty, tooLong: .nameTooLong)
    }

    public static func issue(ofNotes notes: String) -> RuleIssue? {
        let codePoints = notes.replacing(windowsLineBreak, with: lineFeed).unicodeScalars.count
        guard codePoints > TaskLimits.notesMaxLength else { return nil }
        return .notesTooLong
    }

    private static func singleLineIssue(of text: String, maxLength: Int, empty: RuleIssue, tooLong: RuleIssue) -> RuleIssue? {
        let collapsed = text.split(whereSeparator: \.isWhitespace).joined(separator: singleSpace)
        guard !collapsed.isEmpty else { return empty }
        guard collapsed.unicodeScalars.count > maxLength else { return nil }
        return tooLong
    }
}
