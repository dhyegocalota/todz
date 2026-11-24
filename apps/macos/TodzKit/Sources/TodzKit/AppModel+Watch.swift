typealias ChangeSignalStream = AsyncThrowingStream<ChangeSignalEvent, any Error>

extension AppModel {
    func followActiveProjects() {
        guard let session, let activeWorkspace else { return }
        let listedIdentifiers = activeWorkspace.projects.map(\.identifier)
        watches.keys
            .filter { !listedIdentifiers.contains($0) }
            .forEach { watches.removeValue(forKey: $0)?.cancel() }
        listedIdentifiers
            .filter { watches[$0] == nil }
            .forEach { projectIdentifier in
                let events = signals.watch(session: session, projectIdentifier: projectIdentifier)
                watches[projectIdentifier] = Task { await self.follow(events, projectIdentifier: projectIdentifier) }
            }
    }

    func stopWatching() {
        watches.values.forEach { $0.cancel() }
        watches = [:]
    }

    private func follow(_ events: ChangeSignalStream, projectIdentifier: String) async {
        do {
            for try await event in events {
                await take(event, projectIdentifier: projectIdentifier)
            }
        } catch {
            return
        }
    }

    private func take(_ event: ChangeSignalEvent, projectIdentifier: String) async {
        switch event {
        case .opened:
            startSending()
            guard isWorkspaceListOutdated else { return }
            await reloadWorkspacesQuietly()
        case .changed:
            return
        }
    }
}
