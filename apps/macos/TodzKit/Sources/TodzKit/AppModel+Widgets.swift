import Observation

extension AppModel {
    var widgetSnapshot: WidgetSnapshotState {
        switch phase {
        case .loading: .loading
        case .signedOut, .naming: .absent
        case .ready: readyWidgetSnapshot
        }
    }

    private var readyWidgetSnapshot: WidgetSnapshotState {
        guard let workspace = activeWorkspace, isTodayKnown(in: workspace), let views = taskViews else { return .absent }
        return .ready(WidgetSnapshot.of(views: views, workspace: workspace, day: today, timeZone: timeZone))
    }

    private func isTodayKnown(in workspace: Workspace) -> Bool {
        let isFirstLoad = workspace.projects.contains { projectLoads[$0.identifier] == nil }
        return !isFirstLoad && loadFailure(of: workspace) == nil
    }

    public func dayChanged() {
        publishWidgets()
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

    // NB ADR 0032: the app writes the snapshot whenever the active workspace's Today changes, then reloads the widgets.
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
