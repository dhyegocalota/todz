extension AppModel {
    public func dayCloseTasks(lingers: CompletionLingers) -> [BoardTask]? {
        guard todayHeadingCount != nil, let taskViews else { return nil }
        return lingers.placed(into: taskViews.today.open, item: .today, views: taskViews)
    }

    public func isDayClosed(lingers: CompletionLingers) -> Bool {
        guard let tasks = dayCloseTasks(lingers: lingers), let taskViews else { return false }
        return tasks.isEmpty && taskViews.pendingTasks(for: .today).isEmpty
    }
}
