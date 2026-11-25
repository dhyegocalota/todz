public struct ShortcutToday: Equatable, Sendable {
    public let workspaceName: String
    public let content: MorningGlanceContent
    public let tasks: [ShortcutTask]
    public let isOffline: Bool

    public var sentence: ShortcutTodaySentence {
        fatalError("ShortcutToday.sentence is not implemented")
    }

    public var spokenTitles: [String] {
        fatalError("ShortcutToday.spokenTitles is not implemented")
    }
}
