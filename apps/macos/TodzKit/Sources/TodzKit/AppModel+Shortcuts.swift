import Foundation

extension AppModel {
    public var shortcutToday: ShortcutToday? {
        guard let workspace = activeWorkspace, let content = morningGlanceContent, let taskViews else { return nil }
        return ShortcutToday(
            workspaceName: workspace.name,
            content: content,
            tasks: taskViews.today.open.map(ShortcutTask.of),
            isOffline: isOffline
        )
    }

    public var shortcutSuggestedTasks: [ShortcutTask] {
        guard let taskViews else { return [] }
        return taskViews.today.open.prefix(ShortcutLimits.taskLimit).map(ShortcutTask.of)
    }

    public func shortcutTasks(matching text: String) -> [ShortcutTask] {
        let searchedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !searchedText.isEmpty, let workspace = activeWorkspace, let taskViews else { return [] }
        return openTasksInShortcutOrder(views: taskViews, workspace: workspace)
            .filter { $0.task.title.localizedStandardContains(searchedText) }
            .prefix(ShortcutLimits.taskLimit)
            .map(ShortcutTask.of)
    }

    public func shortcutTasks(for keys: [TaskKey]) -> [ShortcutTask] {
        guard let workspace = activeWorkspace else { return [] }
        let shownBoard = board.applying(outbox)
        return keys.compactMap { key in
            let project = workspace.projects.first { $0.identifier == key.projectIdentifier }
            let task = shownBoard.task(projectIdentifier: key.projectIdentifier, number: key.number)
            guard let project, let task else { return nil }
            return ShortcutTask.of(BoardTask(project: project, task: task))
        }
    }

    private func openTasksInShortcutOrder(views: TaskViews, workspace: Workspace) -> [BoardTask] {
        let todayTasks = views.today.open
        let todayKeys = Set(todayTasks.map { ShortcutTask.of($0).key })
        let laterTasks = workspace.projects
            .flatMap { views.project(identifier: $0.identifier) }
            .filter { !todayKeys.contains(ShortcutTask.of($0).key) }
        return todayTasks + laterTasks
    }
}
