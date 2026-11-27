private let attemptLimit = 3

private struct WaitingChange: Codable, Sendable, Equatable {
    let change: PendingChange
    let attempts: Int
}

private func isReplaceable(_ waiting: PendingChange, by change: PendingChange) -> Bool {
    guard let taskKey = change.taskKey, change.writeField != .order else { return false }
    return waiting.taskKey == taskKey && waiting.writeField == change.writeField
}

// NB ADR 0028: a waiting change of the same task and field is replaced in place, but moves are always appended.
public struct Outbox: Codable, Sendable, Equatable {
    private var changes: [WaitingChange] = []

    public init() {}

    private init(changes: [WaitingChange]) {
        self.changes = changes
    }

    public var count: Int {
        changes.count
    }

    public var head: PendingChange? {
        changes.first?.change
    }

    var pendingChanges: [PendingChange] {
        changes.map(\.change)
    }

    public var pendingTasks: [PendingTask] {
        pendingChanges.compactMap { change in
            guard case let .add(projectIdentifier, draft) = change else { return nil }
            return PendingTask(projectIdentifier: projectIdentifier, idempotencyKey: draft.idempotencyKey, title: draft.title, dueDate: draft.dueDate)
        }
    }

    public func appending(_ change: PendingChange, isHeadSent: Bool) -> Outbox {
        let replaceableIndex = changes.indices.last { index in
            let isTheSentHead = isHeadSent && index == changes.startIndex
            return !isTheSentHead && isReplaceable(changes[index].change, by: change)
        }
        let waiting = WaitingChange(change: change, attempts: 0)
        guard let replaceableIndex else { return Outbox(changes: changes + [waiting]) }
        var replaced = changes
        replaced[replaceableIndex] = waiting
        return Outbox(changes: replaced)
    }

    public func removingHead() -> Outbox {
        Outbox(changes: Array(changes.dropFirst()))
    }

    public func countingAttemptOnHead() -> (Outbox, isAtLimit: Bool) {
        guard let first = changes.first else { return (self, isAtLimit: false) }
        let attempts = first.attempts + 1
        let counted = [WaitingChange(change: first.change, attempts: attempts)] + changes.dropFirst()
        return (Outbox(changes: counted), isAtLimit: attempts >= attemptLimit)
    }

    public func droppingChanges(taskKey: TaskKey, isHeadSent: Bool) -> Outbox {
        let kept = changes.enumerated().filter { index, waiting in
            let isTheSentHead = isHeadSent && index == changes.startIndex
            return isTheSentHead || waiting.change.taskKey != taskKey
        }
        return Outbox(changes: kept.map(\.element))
    }

    public func droppingChanges(projectIdentifier: String) -> (Outbox, dropped: Int) {
        let kept = changes.filter { $0.change.projectIdentifier != projectIdentifier }
        return (Outbox(changes: kept), dropped: changes.count - kept.count)
    }
}
