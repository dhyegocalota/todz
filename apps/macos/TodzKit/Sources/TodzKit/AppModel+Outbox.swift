extension AppModel {
    func enqueue(_ change: PendingChange) {
        guard let session else { return }
        outbox = outbox.appending(change, isHeadSent: headInFlightSession == session)
        keepOutbox()
        startSending()
    }

    func startSending() {
        sendWait?.cancel()
        guard let session, sendingSession == nil else { return }
        sendingSession = session
        sendLoop = Task { await sendOutbox(session: session) }
    }

    func stopSending() {
        sendLoop?.cancel()
        sendWait?.cancel()
        sendLoop = nil
        sendWait = nil
        sendingSession = nil
        headInFlightSession = nil
        sendFailures = 0
        refusalsInFlush = 0
    }

    func countRefusals(_ count: Int) {
        refusalsInFlush += count
        raise(.changesRefused(count: refusalsInFlush))
    }

    private func sendOutbox(session: String) async {
        while let change = outbox.head, self.session == session {
            let isGoingOn = await send(change, session: session)
            guard isGoingOn else { break }
        }
        endFlush(session: session)
    }

    private func endFlush(session: String) {
        guard sendingSession == session else { return }
        sendingSession = nil
        sendLoop = nil
        refusalsInFlush = 0
    }

    private func send(_ change: PendingChange, session: String) async -> Bool {
        let records: [TaskRecord]
        do {
            records = try await delivered(change, session: session)
        } catch {
            guard self.session == session else { return false }
            return await recover(from: error, sending: change)
        }
        sendFailures = 0
        removeHead(change)
        take(records, answering: change)
        return true
    }

    private func delivered(_ change: PendingChange, session: String) async throws -> [TaskRecord] {
        headInFlightSession = session
        defer { endHeadInFlight(session: session) }
        return try await deliver(change)
    }

    private func endHeadInFlight(session: String) {
        guard headInFlightSession == session else { return }
        headInFlightSession = nil
    }

    private func deliver(_ change: PendingChange) async throws -> [TaskRecord] {
        switch change {
        case let .add(projectIdentifier, draft):
            let added = try await request { try await service.addTasks(session: $0, projectIdentifier: projectIdentifier, drafts: [draft]) }
            return added.map(\.task)
        case let .field(key, patch):
            let updated = try await request {
                try await service.updateTask(session: $0, projectIdentifier: key.projectIdentifier, number: key.number, patch: patch)
            }
            return [updated]
        case let .state(key, .done, _):
            let completed = try await request {
                try await service.completeTasks(session: $0, projectIdentifier: key.projectIdentifier, numbers: [key.number])
            }
            return completed.map(\.task)
        case let .state(key, .open, _):
            let reopened = try await request {
                try await service.reopenTasks(session: $0, projectIdentifier: key.projectIdentifier, numbers: [key.number])
            }
            return reopened.map(\.task)
        }
    }

    private func recover(from error: any Error, sending change: PendingChange) async -> Bool {
        switch SendOutcome.of(error) {
        case .refused:
            await refuse(change)
            return true
        case .unreachable:
            await waitToSend()
            return true
        case .unexpected:
            await countAttempt(sending: change)
            return true
        case .sessionGone:
            return false
        }
    }

    private func countAttempt(sending change: PendingChange) async {
        guard outbox.head == change else { return }
        let (counted, isAtLimit) = outbox.countingAttemptOnHead()
        guard !isAtLimit else {
            await refuse(change)
            return
        }
        outbox = counted
        keepOutbox()
        await waitToSend()
    }

    private func refuse(_ change: PendingChange) async {
        sendFailures = 0
        removeHead(change)
        countRefusals(1)
        guard isShown(projectIdentifier: change.projectIdentifier) else { return }
        await pullFromStart(projectIdentifier: change.projectIdentifier)
    }

    private func waitToSend() async {
        sendFailures += 1
        let waiting = Task { try await pause(ReconnectDelay.after(attempt: sendFailures)) }
        sendWait = waiting
        _ = await waiting.result
        if sendWait == waiting { sendWait = nil }
    }

    private func removeHead(_ change: PendingChange) {
        guard outbox.head == change else { return }
        outbox = outbox.removingHead()
        keepOutbox()
    }

    private func take(_ records: [TaskRecord], answering change: PendingChange) {
        records.forEach { place($0, projectIdentifier: change.projectIdentifier) }
        guard case let .add(projectIdentifier, draft) = change, let added = records.first else { return }
        select(added, projectIdentifier: projectIdentifier, idempotencyKey: draft.idempotencyKey)
    }

    private func place(_ task: TaskRecord, projectIdentifier: String) {
        guard isShown(projectIdentifier: projectIdentifier) else {
            keepInProjectFile(task, projectIdentifier: projectIdentifier)
            return
        }
        board.replace(projectIdentifier: projectIdentifier, task: task)
        keepProject(identifier: projectIdentifier)
    }

    private func select(_ added: TaskRecord, projectIdentifier: String, idempotencyKey: String) {
        guard let selectionAtAdd = selectionsAtAdd.removeValue(forKey: idempotencyKey) else { return }
        let isSelectionUnmoved = selectionAtAdd == selectedTask && isShown(projectIdentifier: projectIdentifier)
        guard isSelectionUnmoved else { return }
        selectedTask = TaskKey(projectIdentifier: projectIdentifier, number: added.number)
    }
}
