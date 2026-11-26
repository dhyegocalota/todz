import Observation

extension AppModel {
    public func follow(_ link: WidgetLink) {
        let isObservingToday = waitingLink != nil
        waitingLink = link
        guard !isObservingToday else { return }
        followWaitingLink()
    }

    private var isAwaitingToday: Bool {
        guard phase != .loading else { return true }
        guard phase == .ready, activeWorkspace != nil else { return false }
        return isFirstLoad(of: shownWorkspaces)
    }

    private func followWaitingLink() {
        guard let waitingLink else { return }
        guard !isAwaitingToday else {
            observeToday()
            return
        }
        self.waitingLink = nil
        open(waitingLink)
    }

    private func observeToday() {
        withObservationTracking {
            _ = isAwaitingToday
        } onChange: { [weak self] in
            MainActor.assumeIsolated {
                self?.linkFollowing = Task { [weak self] in
                    self?.followWaitingLink()
                }
            }
        }
    }

    private func open(_ link: WidgetLink) {
        guard case let .task(key) = link, isInToday(key) else {
            selectedItem = .today
            selectedTask = nil
            return
        }
        reveal(task: key)
        linkRevealCount += 1
    }

    private func isInToday(_ key: TaskKey) -> Bool {
        guard let today = taskViews?.today else { return false }
        return (today.open + today.doneToday).contains { $0.project.identifier == key.projectIdentifier && $0.task.number == key.number }
    }
}
