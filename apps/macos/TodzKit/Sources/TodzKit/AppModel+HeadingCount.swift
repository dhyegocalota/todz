extension AppModel {
    public var todayHeadingCount: Int? {
        guard let workspace = activeWorkspace, isTodayKnown(in: workspace), let taskViews else { return nil }
        return taskViews.today.open.count
    }
}
