import Observation

extension AppModel {
    var widgetSnapshot: WidgetSnapshotState {
        switch phase {
        case .loading: .loading
        case .signedOut, .naming, .choosing: .absent
        case .ready: readyWidgetSnapshot
        }
    }

    private var readyWidgetSnapshot: WidgetSnapshotState {
        guard let workspace = activeWorkspace, isTodayKnown(in: workspace), let views = taskViews else { return .absent }
        return .ready(WidgetSnapshot.of(views: views, workspaces: [workspace], day: today, timeZone: timeZone, showsDayTemperature: showsDayTemperature))
    }

    func isTodayKnown(in workspace: Workspace) -> Bool {
        !isFirstLoad(of: workspace) && loadFailure(of: workspace) == nil
    }

    public func dayChanged() {
        publishWidgets()
    }

    public func widgetRequestsAdded() {
        guard widgetIntake == nil else { return }
        widgetIntake = Task { [weak self] in
            await self?.takeWidgetRequests()
            self?.republishRedrawnWidgets()
            self?.widgetIntake = nil
        }
    }

    public func takeWidgetRequests() async {
        guard case .ready = widgetSnapshot else { return }
        let stored: [StoredWidgetRequest]
        do {
            stored = try widgetStore.requests()
        } catch {
            return
        }
        guard !stored.isEmpty else { return }
        let removed: [String]
        do {
            removed = try widgetStore.removeRequests(stored.map(\.name))
        } catch {
            return
        }
        for request in stored.filter({ removed.contains($0.name) }).map(\.request) {
            await take(request)
        }
        guard case let .ready(snapshot) = widgetSnapshot else { return }
        writeWidgetSnapshot(snapshot)
    }

    private func republishRedrawnWidgets() {
        guard isWidgetSnapshotRedrawn else { return }
        publishedWidgetSnapshot = nil
        publishWidgets()
    }

    private var isWidgetSnapshotRedrawn: Bool {
        let stored: WidgetSnapshot?
        do {
            stored = try widgetStore.readSnapshot()
        } catch {
            return true
        }
        guard let stored else { return publishedWidgetSnapshot != .absent }
        return publishedWidgetSnapshot != .ready(stored)
    }

    // NB ADR 0033: a widget's request reaches the outbox only for a task in the current Today that is not already in that state.
    private func take(_ request: WidgetRequest) async {
        guard let today = taskViews?.today else { return }
        let isRequested = { (boardTask: BoardTask) in
            boardTask.project.identifier == request.projectIdentifier && boardTask.task.number == request.number
        }
        let requested = (today.open + today.doneToday).first(where: isRequested)
        guard let requested, requested.task.state != request.state else { return }
        let key = TaskKey(projectIdentifier: request.projectIdentifier, number: request.number)
        switch request.state {
        case .done: await complete(task: key)
        case .open: await reopen(task: key)
        }
    }

    func observeWidgets() {
        withObservationTracking {
            _ = widgetSnapshot
        } onChange: { [weak self] in
            MainActor.assumeIsolated {
                self?.widgetPublication = Task { [weak self] in
                    self?.publishWidgets()
                    self?.observeWidgets()
                }
            }
        }
    }

    // NB ADR 0033: the app writes the snapshot whenever the active workspace's Today changes, then reloads the widgets.
    func publishWidgets() {
        let state = widgetSnapshot
        let isUnchanged = state == .loading || state == publishedWidgetSnapshot
        guard !isUnchanged else { return }
        switch state {
        case .loading: return
        case .absent: eraseWidgetSnapshot()
        case let .ready(snapshot): writeWidgetSnapshot(snapshot)
        }
    }

    // NB ADR 0033: sign-out and another owner erase the snapshot and the requests with the cache, and a failed erase never keeps a session or a cache.
    func eraseWidgets() {
        try? widgetStore.erase()
        publishedWidgetSnapshot = nil
        reloadWidgets()
    }

    func writeWidgetSnapshot(_ snapshot: WidgetSnapshot) {
        do {
            try widgetStore.writeSnapshot(snapshot)
        } catch {
            return
        }
        publishedWidgetSnapshot = .ready(snapshot)
        reloadWidgets()
    }

    private func eraseWidgetSnapshot() {
        do {
            try widgetStore.eraseSnapshot()
        } catch {
            return
        }
        publishedWidgetSnapshot = .absent
        reloadWidgets()
    }
}
