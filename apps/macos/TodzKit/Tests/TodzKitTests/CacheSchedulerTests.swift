import Foundation
import Testing
@testable import TodzKit

@Suite struct CacheSchedulerTests {
    @Test func theImmediateSchedulerRunsBeforeItReturns() {
        let log = LockedLog()
        CacheScheduler.immediate.run { log.append("ran") }
        #expect(log.lines == ["ran"])
    }

    @Test func theBackgroundSchedulerRunsOffTheMainThreadAndInOrder() async {
        let scheduler = CacheScheduler.background
        let order = await withCheckedContinuation { continuation in
            let log = LockedLog()
            scheduler.run { log.append("first:\(Thread.isMainThread)") }
            scheduler.run {
                log.append("second:\(Thread.isMainThread)")
                continuation.resume(returning: log.lines)
            }
        }
        #expect(order == ["first:false", "second:false"])
    }
}

private final class LockedLog: @unchecked Sendable {
    private let lock = NSLock()
    private var recorded: [String] = []

    var lines: [String] {
        lock.withLock { recorded }
    }

    func append(_ line: String) {
        lock.withLock { recorded.append(line) }
    }
}
