private struct HeldWait {
    let identifier: Int
    let continuation: CheckedContinuation<Void, any Error>
}

private struct PauseWaiter {
    let count: Int
    let continuation: CheckedContinuation<Void, Never>
}

@MainActor final class HeldPause {
    private(set) var durations: [Duration] = []
    private var held: [HeldWait] = []
    private var waiters: [PauseWaiter] = []

    var heldCount: Int {
        held.count
    }

    func pause(_ duration: Duration) async throws {
        let identifier = durations.count
        durations.append(duration)
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                held.append(HeldWait(identifier: identifier, continuation: continuation))
                answerWaiters()
            }
        } onCancel: {
            Task { @MainActor in self.cancel(identifier: identifier) }
        }
    }

    func started(count: Int = 1) async {
        guard durations.count < count else { return }
        await withCheckedContinuation { waiters.append(PauseWaiter(count: count, continuation: $0)) }
    }

    func release() {
        guard let oldest = held.first else { return }
        held.removeFirst()
        oldest.continuation.resume()
    }

    private func cancel(identifier: Int) {
        guard let index = held.firstIndex(where: { $0.identifier == identifier }) else { return }
        held.remove(at: index).continuation.resume(throwing: CancellationError())
    }

    private func answerWaiters() {
        let isAnswered: (PauseWaiter) -> Bool = { $0.count <= self.durations.count }
        let answered = waiters.filter(isAnswered)
        waiters.removeAll(where: isAnswered)
        answered.forEach { $0.continuation.resume() }
    }
}
