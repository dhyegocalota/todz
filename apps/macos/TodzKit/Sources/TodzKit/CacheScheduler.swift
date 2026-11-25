import Foundation

private let backgroundQueueLabel = "dev.todz.cache-writer"

public struct CacheScheduler: Sendable {
    let run: @Sendable (@escaping @Sendable () -> Void) -> Void

    public init(run: @escaping @Sendable (@escaping @Sendable () -> Void) -> Void) {
        self.run = run
    }

    public static let immediate = CacheScheduler { $0() }

    public static var background: CacheScheduler {
        let queue = DispatchQueue(label: backgroundQueueLabel, qos: .utility)
        return CacheScheduler { queue.async(execute: $0) }
    }
}
