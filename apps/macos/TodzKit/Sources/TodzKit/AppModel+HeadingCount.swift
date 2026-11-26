extension AppModel {
    public var todayHeadingCount: Int? {
        guard isTodayKnown(in: shownWorkspaces), let taskViews else { return nil }
        return taskViews.today.open.count
    }
}
