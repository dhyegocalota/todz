typealias ChangeSignalStream = AsyncThrowingStream<ChangeSignalEvent, any Error>

extension AppModel {
    func followActiveProjects() {
        guard let session, let activeWorkspace else { return }
        let listedIdentifiers = activeWorkspace.projects.map(\.identifier)
        let leftIdentifiers = watches.keys.filter { !listedIdentifiers.contains($0) }
        leftIdentifiers.forEach { projectIdentifier in
            watches.removeValue(forKey: projectIdentifier)?.cancel()
            watchAttempts[projectIdentifier] = nil
        }
        dropChanges(projectIdentifiers: leftIdentifiers)
        leftIdentifiers.forEach { forgetProject(identifier: $0) }
        listedIdentifiers
            .filter { watches[$0] == nil }
            .forEach { projectIdentifier in
                let events = signals.watch(session: session, projectIdentifier: projectIdentifier)
                watches[projectIdentifier] = Task { await self.follow(events, projectIdentifier: projectIdentifier, session: session) }
            }
    }

    func stopWatching() {
        watches.values.forEach { $0.cancel() }
        watches = [:]
        watchAttempts = [:]
        workspaceReload?.cancel()
        workspaceReload = nil
    }

    func requestWorkspaceReload() {
        guard let session, workspaceReload == nil, workspaceListingsInFlight == 0 else { return }
        workspaceReload = Task {
            await reloadWorkspacesQuietly()
            guard self.session == session else { return }
            workspaceReload = nil
        }
    }

    private func dropChanges(projectIdentifiers: [String]) {
        projectIdentifiers.forEach { projectIdentifier in
            let (kept, dropped) = outbox.droppingChanges(projectIdentifier: projectIdentifier)
            guard dropped > 0 else { return }
            outbox = kept
            keepOutbox()
            countRefusals(dropped)
        }
    }

    // NB ADR 0029: a socket that fails reopens after the reconnect delay; one that ends without an error was closed and never reopens.
    private func follow(_ firstEvents: ChangeSignalStream, projectIdentifier: String, session: String) async {
        var events = firstEvents
        while let failure = await failure(following: events, projectIdentifier: projectIdentifier) {
            let isReopening = await isReopening(after: failure, projectIdentifier: projectIdentifier, session: session)
            guard isReopening else { return }
            events = signals.watch(session: session, projectIdentifier: projectIdentifier)
        }
    }

    private func failure(following events: ChangeSignalStream, projectIdentifier: String) async -> (any Error)? {
        do {
            for try await event in events {
                take(event, projectIdentifier: projectIdentifier)
            }
            return nil
        } catch {
            return error
        }
    }

    private func isReopening(after failure: any Error, projectIdentifier: String, session: String) async -> Bool {
        let isWatchCurrent = self.session == session && !Task.isCancelled
        guard isWatchCurrent else { return false }
        let ownerFailure = failure as? OwnerAPIError
        guard ownerFailure != .unauthorized else {
            endSession()
            return false
        }
        noteConnection(after: failure)
        if ownerFailure == .notFound { requestWorkspaceReload() }
        let attempt = watchAttempts[projectIdentifier, default: 0] + 1
        watchAttempts[projectIdentifier] = attempt
        do {
            try await pause(ReconnectDelay.after(attempt: attempt))
        } catch {
            return false
        }
        return self.session == session && !Task.isCancelled
    }

    private func take(_ event: ChangeSignalEvent, projectIdentifier: String) {
        switch event {
        case .opened:
            watchAttempts[projectIdentifier] = nil
            startSending()
            guard !isWorkspaceListOutdated else {
                requestWorkspaceReload()
                return
            }
            requestPull(projectIdentifier: projectIdentifier)
        case .changed:
            requestPull(projectIdentifier: projectIdentifier)
        }
    }
}
