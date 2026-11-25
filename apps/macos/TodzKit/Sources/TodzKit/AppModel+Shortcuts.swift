extension AppModel {
    public var shortcutToday: ShortcutToday? {
        fatalError("AppModel.shortcutToday is not implemented")
    }

    public var shortcutSuggestedTasks: [ShortcutTask] {
        fatalError("AppModel.shortcutSuggestedTasks is not implemented")
    }

    public func shortcutTasks(matching text: String) -> [ShortcutTask] {
        fatalError("AppModel.shortcutTasks(matching:) is not implemented")
    }

    public func shortcutTasks(for keys: [TaskKey]) -> [ShortcutTask] {
        fatalError("AppModel.shortcutTasks(for:) is not implemented")
    }
}
