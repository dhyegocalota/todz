public enum ShortcutResolution: Equatable, Sendable {
    case one(ShortcutTask)
    case many([ShortcutTask])
    case none
}

extension AppModel {
    public func shortcutResolution(matching text: String) -> ShortcutResolution {
        fatalError("AppModel.shortcutResolution(matching:) is not implemented")
    }
}
