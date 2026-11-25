import Foundation
import Observation

@MainActor private final class ShortcutWait {
    private var continuation: CheckedContinuation<Void, Never>?
    var bound: Task<Void, Never>?

    init(continuation: CheckedContinuation<Void, Never>) {
        self.continuation = continuation
    }

    var isOver: Bool {
        continuation == nil
    }

    func end() {
        bound?.cancel()
        continuation?.resume()
        continuation = nil
    }
}

extension AppModel {
    public var shortcutToday: ShortcutToday? {
        guard let workspace = activeWorkspace, let content = morningGlanceContent, let taskViews else { return nil }
        return ShortcutToday(
            workspaceName: workspace.name,
            content: content,
            tasks: taskViews.today.open.map(ShortcutTask.of),
            isOffline: isOffline || !isLaunchSettled
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
        keys.compactMap(shownBoardTask(key:)).map(ShortcutTask.of)
    }

    public func shortcutReadiness() async -> ShortcutReadiness {
        if !hasLaunched { Task { await launch() } }
        guard !isShortcutReadinessSettled else { return currentShortcutReadiness }
        await withCheckedContinuation { continuation in
            let wait = ShortcutWait(continuation: continuation)
            wait.bound = Task { [pause] in
                try? await pause(ShortcutLimits.readinessWait)
                wait.end()
            }
            observeShortcutReadiness(until: wait)
        }
        return currentShortcutReadiness
    }

    public func addFromShortcut(title: String, isDueToday: Bool) async -> ShortcutAddition {
        guard session != nil else { return .signedOut }
        let destination: ShortcutAddDestination = isDueToday ? .today : .inbox
        guard let workspace = activeWorkspace, let addDestination = addTaskDestination(for: destination.sidebarItem) else { return .noWorkspace }
        if let issue = TextCheck.issue(ofTitle: title) { return .refused(issue) }
        await addTask(title: title, projectIdentifier: addDestination.projectIdentifier, dueDate: addDestination.dueDate, selection: .keepSelection)
        return .added(title: title, destination: destination, workspaceName: workspace.name, isOffline: isOffline)
    }

    public func completeFromShortcut(key: TaskKey) async -> ShortcutCompletion {
        guard session != nil else { return .signedOut }
        guard let boardTask = shownBoardTask(key: key) else { return .notFound }
        guard boardTask.task.state == .open else { return .alreadyDone(title: boardTask.task.title) }
        await complete(task: key)
        return .completed(title: boardTask.task.title, isOffline: isOffline)
    }

    private var currentShortcutReadiness: ShortcutReadiness {
        switch phase {
        case .signedOut: .signedOut
        case .naming: .noWorkspace
        case .loading: .loading
        case .ready: isActiveTodayKnown ? .ready : .loading
        }
    }

    private var isActiveTodayKnown: Bool {
        guard let activeWorkspace else { return false }
        return isTodayKnown(in: activeWorkspace)
    }

    private var isShortcutReadinessSettled: Bool {
        let readiness = currentShortcutReadiness
        let isAwaitingTheFirstPull = readiness == .ready && !isLaunchSettled && !isOffline
        return readiness != .loading && !isAwaitingTheFirstPull
    }

    private func observeShortcutReadiness(until wait: ShortcutWait) {
        withObservationTracking {
            _ = isShortcutReadinessSettled
        } onChange: { [weak self] in
            MainActor.assumeIsolated {
                _ = Task { [weak self] in
                    self?.reviewShortcutReadiness(until: wait)
                }
            }
        }
    }

    private func reviewShortcutReadiness(until wait: ShortcutWait) {
        guard !wait.isOver else { return }
        guard isShortcutReadinessSettled else {
            observeShortcutReadiness(until: wait)
            return
        }
        wait.end()
    }

    private func shownBoardTask(key: TaskKey) -> BoardTask? {
        let project = activeWorkspace?.projects.first { $0.identifier == key.projectIdentifier }
        let task = board.applying(outbox).task(projectIdentifier: key.projectIdentifier, number: key.number)
        guard let project, let task else { return nil }
        return BoardTask(project: project, task: task)
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
