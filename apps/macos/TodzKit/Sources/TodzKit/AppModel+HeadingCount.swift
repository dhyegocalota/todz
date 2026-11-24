extension AppModel {
    public var todayHeadingCount: Int? {
        guard let workspace = activeWorkspace, let taskViews else { return nil }
        guard !isFirstLoad(of: workspace), loadFailure(of: workspace) == nil else { return nil }
        return taskViews.today.open.count
    }
}
