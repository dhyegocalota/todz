public enum ShortcutResolution: Equatable, Sendable {
    case one(ShortcutTask)
    case many([ShortcutTask])
    case none
}

extension AppModel {
    // NB ADR 0066: a text completes a task only when exactly one open task matches it.
    public func shortcutResolution(matching text: String) -> ShortcutResolution {
        let matches = shortcutTasks(matching: text)
        guard let first = matches.first else { return .none }
        return matches.count == 1 ? .one(first) : .many(matches)
    }
}
