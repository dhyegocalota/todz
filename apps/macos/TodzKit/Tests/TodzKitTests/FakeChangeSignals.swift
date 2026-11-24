@testable import TodzKit

typealias ChangeSignalEvents = AsyncThrowingStream<ChangeSignalEvent, any Error>

struct WatchKey: Hashable, Sendable {
    let session: String
    let projectIdentifier: String
}

private struct SignalWaiter {
    let isMet: @MainActor () -> Bool
    let continuation: CheckedContinuation<Void, Never>
}

@MainActor final class FakeChangeSignals: ChangeSignals {
    private(set) var opens: [WatchKey] = []
    private(set) var cancellations: [WatchKey] = []
    private var streams: [WatchKey: ChangeSignalEvents.Continuation] = [:]
    private var waiters: [SignalWaiter] = []

    nonisolated func watch(session: String, projectIdentifier: String) -> ChangeSignalEvents {
        MainActor.assumeIsolated {
            let key = WatchKey(session: session, projectIdentifier: projectIdentifier)
            let (events, continuation) = ChangeSignalEvents.makeStream()
            continuation.onTermination = { termination in
                guard case .cancelled = termination else { return }
                Task { @MainActor in self.recordCancellation(key) }
            }
            opens.append(key)
            streams[key] = continuation
            answerWaiters()
            return events
        }
    }

    func send(_ event: ChangeSignalEvent, to key: WatchKey) {
        streams[key]?.yield(event)
    }

    func fail(_ key: WatchKey, with failure: OwnerAPIError) {
        streams[key]?.finish(throwing: failure)
    }

    func end(_ key: WatchKey) {
        streams[key]?.finish()
    }

    func openCount(of key: WatchKey) -> Int {
        opens.filter { $0 == key }.count
    }

    func cancellationCount(of key: WatchKey) -> Int {
        cancellations.filter { $0 == key }.count
    }

    func opened(_ key: WatchKey, count: Int = 1) async {
        await wait { self.openCount(of: key) >= count }
    }

    func cancelled(_ key: WatchKey, count: Int = 1) async {
        await wait { self.cancellationCount(of: key) >= count }
    }

    private func wait(until isMet: @escaping @MainActor () -> Bool) async {
        guard !isMet() else { return }
        await withCheckedContinuation { waiters.append(SignalWaiter(isMet: isMet, continuation: $0)) }
    }

    private func recordCancellation(_ key: WatchKey) {
        cancellations.append(key)
        answerWaiters()
    }

    private func answerWaiters() {
        let answered = waiters.filter { $0.isMet() }
        waiters.removeAll { $0.isMet() }
        answered.forEach { $0.continuation.resume() }
    }
}
