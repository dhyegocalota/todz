public struct CacheScheduler: Sendable {
    let run: @Sendable (@escaping @Sendable () -> Void) -> Void

    public init(run: @escaping @Sendable (@escaping @Sendable () -> Void) -> Void) {
        self.run = run
    }

    public static let immediate = CacheScheduler { $0() }
}
