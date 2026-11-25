// NB ADR 0066: a task's Shortcut identifier is its project identifier and its number, split at the last slash.
private let shortcutSeparator: Character = "/"

extension TaskKey {
    public var shortcutIdentifier: String {
        "\(projectIdentifier)\(shortcutSeparator)\(number)"
    }

    public init?(shortcutIdentifier: String) {
        guard let separatorIndex = shortcutIdentifier.lastIndex(of: shortcutSeparator) else { return nil }
        let projectIdentifier = String(shortcutIdentifier[..<separatorIndex])
        let numberText = String(shortcutIdentifier[shortcutIdentifier.index(after: separatorIndex)...])
        guard let number = Int(numberText) else { return nil }
        let isWrittenAsItsNumber = String(number) == numberText
        let isKey = !projectIdentifier.isEmpty && number > 0 && isWrittenAsItsNumber
        guard isKey else { return nil }
        self.init(projectIdentifier: projectIdentifier, number: number)
    }
}
