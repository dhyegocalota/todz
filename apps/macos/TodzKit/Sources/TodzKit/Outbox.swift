public struct Outbox: Codable, Sendable, Equatable {
    public init() {}

    public var count: Int {
        fatalError("Outbox.count is not implemented")
    }

    public var head: PendingChange? {
        fatalError("Outbox.head is not implemented")
    }

    var pendingChanges: [PendingChange] {
        fatalError("Outbox.pendingChanges is not implemented")
    }

    public var pendingTasks: [PendingTask] {
        fatalError("Outbox.pendingTasks is not implemented")
    }

    public func appending(_ change: PendingChange, isHeadSent: Bool) -> Outbox {
        fatalError("Outbox.appending is not implemented")
    }

    public func removingHead() -> Outbox {
        fatalError("Outbox.removingHead is not implemented")
    }

    public func countingAttemptOnHead() -> (Outbox, isAtLimit: Bool) {
        fatalError("Outbox.countingAttemptOnHead is not implemented")
    }

    public func droppingChanges(projectIdentifier: String) -> (Outbox, dropped: Int) {
        fatalError("Outbox.droppingChanges is not implemented")
    }
}
