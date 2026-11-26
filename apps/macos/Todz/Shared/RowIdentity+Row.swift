import TodzKit

extension BoardTask {
    var rowIdentity: RowIdentity {
        guard let attempt = task.idempotencyKey else { return .task(key) }
        return .attempt(attempt)
    }
}

extension PendingTask {
    var rowIdentity: RowIdentity {
        .attempt(idempotencyKey)
    }
}
