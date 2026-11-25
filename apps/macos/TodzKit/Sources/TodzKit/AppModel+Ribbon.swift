extension AppModel {
    public var ribbonContent: RibbonContent? {
        guard todayHeadingCount != nil else { return nil }
        return RibbonContent.of(open: taskViews?.today.open)
    }

    func isAgentChange(projectIdentifier: String, changes: ProjectChanges) -> Bool {
        let isPulledBefore = board.cursor(projectIdentifier: projectIdentifier) != nil
        guard isPulledBefore, !changes.isFromStart else { return false }
        return changes.tasks.contains { arrived in
            let previous = board.task(projectIdentifier: projectIdentifier, number: arrived.number)
            return RibbonTrigger.isAgentChange(previous: previous, arrived: arrived, today: today)
        }
    }
}
