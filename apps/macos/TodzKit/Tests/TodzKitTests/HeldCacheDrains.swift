import Foundation
@testable import TodzKit

final class HeldCacheDrains: @unchecked Sendable {
    private let lock = NSLock()
    private var held: [@Sendable () -> Void] = []

    var scheduler: CacheScheduler {
        CacheScheduler { drain in self.lock.withLock { self.held.append(drain) } }
    }

    var count: Int {
        lock.withLock { held.count }
    }

    func runOffTheMainThread() async {
        await withCheckedContinuation { continuation in
            DispatchQueue.global().async {
                let drains = self.lock.withLock {
                    let taken = self.held
                    self.held = []
                    return taken
                }
                drains.forEach { $0() }
                continuation.resume()
            }
        }
    }
}
