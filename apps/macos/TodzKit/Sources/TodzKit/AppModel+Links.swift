extension AppModel {
    public func follow(_ link: WidgetLink) {
        guard case let .task(key) = link, isInToday(key) else {
            selectedItem = .today
            selectedTask = nil
            return
        }
        reveal(task: key)
    }

    private func isInToday(_ key: TaskKey) -> Bool {
        guard let today = taskViews?.today else { return false }
        return (today.open + today.doneToday).contains { $0.project.identifier == key.projectIdentifier && $0.task.number == key.number }
    }
}
