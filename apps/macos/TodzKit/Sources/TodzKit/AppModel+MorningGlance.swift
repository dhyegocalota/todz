extension AppModel {
    public var morningGlanceContent: MorningGlanceContent? {
        guard let workspace = activeWorkspace, isTodayKnown(in: workspace), let taskViews else { return nil }
        let openTasks = taskViews.today.open
        let rows = openTasks.prefix(MorningGlanceContent.rowLimit).map { WidgetSnapshotTask.of($0, day: today) }
        return MorningGlanceContent(
            workspaceIdentifier: workspace.identifier,
            openCount: openTasks.count,
            rows: rows,
            restCount: openTasks.count - rows.count
        )
    }
}
