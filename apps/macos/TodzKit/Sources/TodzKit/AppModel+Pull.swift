typealias PullGate = (session: String, task: Task<ProjectPull?, Never>)

extension AppModel {
    public var isRefreshing: Bool {
        refreshesInFlight > 0
    }

    public var syncStatus: SyncStatus {
        guard isOffline else { return .online }
        return .offline(waiting: outbox.count)
    }

    func noteConnection(after failure: any Error) {
        switch SendOutcome.of(failure) {
        case .unreachable, .unexpected: isOffline = true
        case .refused: noteAnswer()
        case .sessionGone: return
        }
    }

    func noteAnswer() {
        isOffline = false
        hasServerAnswered = true
    }

    public func refresh() async {
        guard let activeWorkspace else { return }
        refreshesInFlight += 1
        defer { refreshesInFlight -= 1 }
        startSending()
        await pull(projectIdentifiers: activeWorkspace.projects.map(\.identifier), workspaceIdentifier: activeWorkspace.identifier)
    }

    func pull(projectIdentifiers: [String], workspaceIdentifier: String) async {
        guard let session, activeWorkspaceIdentifier == workspaceIdentifier else { return }
        let gates = projectIdentifiers.compactMap { requestPull(projectIdentifier: $0) }
        let pulls = await withTaskGroup(of: ProjectPull?.self) { group in
            gates.forEach { gate in group.addTask { await gate.value } }
            var pulls: [ProjectPull] = []
            for await case let pulled? in group {
                pulls.append(pulled)
            }
            return pulls
        }
        guard isCurrent(session: session, workspaceIdentifier: workspaceIdentifier) else { return }
        raiseFailures(of: pulls, workspaceIdentifier: workspaceIdentifier)
    }

    func pullFromStart(projectIdentifier: String) async {
        projectsToPullFromStart.insert(projectIdentifier)
        await pullProject(identifier: projectIdentifier)
    }

    @discardableResult
    func pullProject(identifier: String) async -> ProjectPull? {
        await requestPull(projectIdentifier: identifier)?.value
    }

    @discardableResult
    func requestPull(projectIdentifier: String) -> Task<ProjectPull?, Never>? {
        guard let session else { return nil }
        queuedPulls.insert(projectIdentifier)
        guard let gate = pullGates[projectIdentifier], gate.session == session else {
            let pulling = Task { await drainPulls(projectIdentifier: projectIdentifier, session: session) }
            pullGates[projectIdentifier] = (session: session, task: pulling)
            return pulling
        }
        return gate.task
    }

    func stopPulling() {
        pullGates.values.forEach { $0.task.cancel() }
        pullGates = [:]
        queuedPulls = []
        projectsToPullFromStart = []
    }

    private func drainPulls(projectIdentifier: String, session: String) async -> ProjectPull? {
        var pulled: ProjectPull?
        while self.session == session, queuedPulls.remove(projectIdentifier) != nil {
            pulled = await pullOnce(projectIdentifier: projectIdentifier, session: session)
        }
        closePullGate(projectIdentifier: projectIdentifier, session: session)
        return pulled
    }

    private func closePullGate(projectIdentifier: String, session: String) {
        guard pullGates[projectIdentifier]?.session == session else { return }
        pullGates[projectIdentifier] = nil
    }

    private func pullOnce(projectIdentifier: String, session: String) async -> ProjectPull? {
        guard let workspaceIdentifier = activeWorkspaceIdentifier, isShown(projectIdentifier: projectIdentifier) else { return nil }
        let feed = ProjectFeed(service: service)
        let cursor = cursorToPull(projectIdentifier: projectIdentifier)
        let pulled: ProjectPull
        do {
            pulled = try await ProjectPull.pulling(feed: feed, session: session, projectIdentifier: projectIdentifier, cursor: cursor)
        } catch {
            guard self.session == session else { return nil }
            endSession()
            return nil
        }
        guard isCurrent(session: session, workspaceIdentifier: workspaceIdentifier) else { return nil }
        record(pulled)
        return pulled
    }

    private func cursorToPull(projectIdentifier: String) -> Int {
        let isPulledFromStart = projectsToPullFromStart.remove(projectIdentifier) != nil
        guard !isPulledFromStart, let cursor = board.cursor(projectIdentifier: projectIdentifier) else { return ProjectFeed.firstCursor }
        return cursor
    }

    private func isCurrent(session: String, workspaceIdentifier: String) -> Bool {
        self.session == session && activeWorkspaceIdentifier == workspaceIdentifier
    }

    private func record(_ pulled: ProjectPull) {
        switch pulled {
        case let .loaded(projectIdentifier, changes):
            if changes.isFromStart { board.reset(projectIdentifier: projectIdentifier) }
            board.merge(projectIdentifier: projectIdentifier, tasks: changes.tasks)
            board = board.setting(cursor: changes.cursor, projectIdentifier: projectIdentifier)
            projectLoads[projectIdentifier] = .loaded
            noteAnswer()
            keepProject(identifier: projectIdentifier)
            startSending()
        case let .unreachable(projectIdentifier), let .failed(projectIdentifier):
            isOffline = true
            guard projectLoads[projectIdentifier] != .loaded else { return }
            projectLoads[projectIdentifier] = pulled.isUnreachable ? .unreachable : .failed
        }
    }

    private func raiseFailures(of pulls: [ProjectPull], workspaceIdentifier: String) {
        let failedIdentifiers = pulls.compactMap(\.failedProjectIdentifier).filter { projectLoads[$0] != .loaded }
        guard !failedIdentifiers.isEmpty else { return }
        let isServerUnreachable = pulls.allSatisfy(\.isUnreachable)
        let banner: AppBanner = isServerUnreachable ? .network : .someProjectsFailed
        raise(banner, retry: { await self.pull(projectIdentifiers: failedIdentifiers, workspaceIdentifier: workspaceIdentifier) })
    }
}
