public struct ShortcutToday: Equatable, Sendable {
    public let workspaceName: String
    public let content: MorningGlanceContent
    public let tasks: [ShortcutTask]
    public let isOffline: Bool

    public var sentence: ShortcutTodaySentence {
        guard !tasks.isEmpty else { return .nothingLeft }
        guard tasks.count > ShortcutLimits.spokenTitleLimit else { return .withTitles }
        return .withFirstTitles
    }

    public var spokenTitles: [String] {
        tasks.prefix(ShortcutLimits.spokenTitleLimit).map(\.title)
    }
}
