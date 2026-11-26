extension AppModel {
    public var morningGlanceContent: MorningGlanceContent? {
        guard let primaryWorkspace = activeWorkspace, isTodayKnown(in: shownWorkspaces), let taskViews else { return nil }
        let openTasks = taskViews.today.open
        let rows = openTasks.prefix(MorningGlanceContent.rowLimit).compactMap { boardTask in
            workspace(ofProject: boardTask.project.identifier).map { WidgetSnapshotTask.of(boardTask, workspace: $0, isWorkspaceTagged: shownWorkspaces.count > 1, day: today) }
        }
        return MorningGlanceContent(
            workspaceIdentifier: primaryWorkspace.identifier,
            openCount: openTasks.count,
            rows: rows,
            restCount: openTasks.count - rows.count
        )
    }
}
