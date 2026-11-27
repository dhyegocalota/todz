typealias PullGate = (session: String, task: Task<ProjectPull?, Never>)

extension AppModel {
    static let pullConcurrencyLimit = 4

    public var isRefreshing: Bool {
        refreshesInFlight > 0
    }

    public var syncStatus: SyncStatus {
        let isWaitingForTheOwner = !isOwnerConfirmed && outbox.head != nil
        guard isOffline || isWaitingForTheOwner else { return .online }
        return .offline(waiting: outbox.count)
    }

    func noteConnection(after failure: any Error) {
        switch SendOutcome.of(failure) {
        case .unreachable, .unexpected: isOffline = true
        case .refused, .paused: noteAnswer()
        case .updateNeeded:
            noteAnswer()
            recordRefusal(of: failure)
        case .sessionGone: return
        }
    }

    func noteAnswer() {
        isOffline = false
        hasServerAnswered = true
        isWatchAnswered = isWatchAnswered.mapValues { _ in true }
    }

    public func refresh() async {
        guard let activeWorkspace else { return }
        refreshesInFlight += 1
        defer { refreshesInFlight -= 1 }
        startSending()
        await pull(projectIdentifiers: shownProjects.map(\.identifier), workspaceIdentifier: activeWorkspace.identifier)
    }

    func pull(projectIdentifiers: [String], workspaceIdentifier: String) async {
        guard let session, activeWorkspaceIdentifier == workspaceIdentifier else { return }
        var pulls: [ProjectPull] = []
        for batch in projectIdentifiers.chunked(into: Self.pullConcurrencyLimit) {
            let gates = batch.compactMap { requestPull(projectIdentifier: $0) }
            for gate in gates {
                guard let pulled = await gate.value else { continue }
                pulls.append(pulled)
            }
        }
        guard isCurrent(session: session, workspaceIdentifier: workspaceIdentifier) else { return }
        raiseFailures(of: pulls, workspaceIdentifier: workspaceIdentifier)
    }

    func pullFromStart(projectIdentifier: String) {
        projectsToPullFromStart.insert(projectIdentifier)
        requestPull(projectIdentifier: projectIdentifier)
    }

    @discardableResult
    func pullProject(identifier: String) async -> ProjectPull? {
        await requestPull(projectIdentifier: identifier)?.value
    }

    @discardableResult
    func requestPull(projectIdentifier: String) -> Task<ProjectPull?, Never>? {
        guard let session else { return nil }
        let gate = pullGates[projectIdentifier]
        let isGateOfThisSession = gate?.session == session
        let isNextPullWaiting = isGateOfThisSession && queuedPulls.contains(projectIdentifier)
        guard !isNextPullWaiting else { return gate?.task }
        let running = isGateOfThisSession ? gate?.task : nil
        queuedPulls.insert(projectIdentifier)
        let pulling = Task { await pull(after: running, projectIdentifier: projectIdentifier, session: session) }
        pullGates[projectIdentifier] = (session: session, task: pulling)
        return pulling
    }

    func stopPulling() {
        pullGates.values.forEach { $0.task.cancel() }
        pullGates = [:]
        queuedPulls = []
        projectsToPullFromStart = []
    }

    private func pull(after running: Task<ProjectPull?, Never>?, projectIdentifier: String, session: String) async -> ProjectPull? {
        _ = await running?.value
        let isStillQueued = self.session == session && !Task.isCancelled && queuedPulls.contains(projectIdentifier)
        guard isStillQueued else { return nil }
        queuedPulls.remove(projectIdentifier)
        return await pullOnce(projectIdentifier: projectIdentifier, session: session)
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
        guard isCurrent(session: session, workspaceIdentifier: workspaceIdentifier), isShown(projectIdentifier: projectIdentifier) else { return nil }
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
            let arrivedNumbers = arrivedNumbers(projectIdentifier: projectIdentifier, tasks: changes.tasks)
            if isAgentChange(projectIdentifier: projectIdentifier, changes: changes) { agentChangeCount += 1 }
            if changes.isFromStart { board.reset(projectIdentifier: projectIdentifier) }
            board.merge(projectIdentifier: projectIdentifier, tasks: changes.tasks)
            board.remove(projectIdentifier: projectIdentifier, numbers: changes.deletedNumbers)
            board = board.setting(cursor: changes.cursor, projectIdentifier: projectIdentifier)
            arrivedNumbers.forEach { onTaskArrived?($0) }
            projectLoads[projectIdentifier] = .loaded
            noteAnswer()
            keepProject(identifier: projectIdentifier)
            startSending()
        case .notFound:
            noteAnswer()
            requestWorkspaceReload()
        case let .unreachable(projectIdentifier), let .failed(projectIdentifier):
            isOffline = true
            guard projectLoads[projectIdentifier] != .loaded else { return }
            projectLoads[projectIdentifier] = pulled.isUnreachable ? .unreachable : .failed
        }
    }

    private func arrivedNumbers(projectIdentifier: String, tasks: [TaskRecord]) -> [Int] {
        let isPulledBefore = board.cursor(projectIdentifier: projectIdentifier) != nil
        guard onTaskArrived != nil, isPulledBefore, projectIdentifier == windowProjectIdentifier else { return [] }
        return tasks.map(\.number).filter { board.task(projectIdentifier: projectIdentifier, number: $0) == nil }
    }

    private var windowProjectIdentifier: String? {
        switch selectedItem {
        case .inbox: activeWorkspace?.projects.first(where: \.isInbox)?.identifier
        case let .project(identifier): identifier
        case .today, .upcoming, .done, .connectAgent: nil
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

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        stride(from: 0, to: count, by: size).map { Array(self[$0..<Swift.min($0 + size, count)]) }
    }
}
