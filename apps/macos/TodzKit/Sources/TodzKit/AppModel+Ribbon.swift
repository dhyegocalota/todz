extension AppModel {
    public var ribbonContent: RibbonContent? {
        guard todayHeadingCount != nil else { return nil }
        return RibbonContent.of(open: taskViews?.today.open)
    }
}
