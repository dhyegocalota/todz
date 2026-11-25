import AppIntents

struct TodzShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LeftTodayIntent(),
            phrases: ["What's left today in \(.applicationName)", "What do I have today in \(.applicationName)"],
            shortTitle: "What's Left Today",
            systemImageName: "checklist"
        )
        AppShortcut(
            intent: AddTaskIntent(),
            phrases: ["Add a task to \(.applicationName)", "New task in \(.applicationName)"],
            shortTitle: "Add a Task",
            systemImageName: "plus.circle"
        )
        AppShortcut(
            intent: CompleteTaskIntent(),
            phrases: ["Complete a task in \(.applicationName)", "Check off a task in \(.applicationName)"],
            shortTitle: "Complete a Task",
            systemImageName: "checkmark.circle"
        )
    }
}
