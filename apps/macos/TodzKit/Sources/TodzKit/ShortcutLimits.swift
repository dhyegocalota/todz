public enum ShortcutLimits {
    // NB ADR 0066: a Shortcut waits for Today at most five seconds, then answers from the cache marked offline or refuses.
    public static let readinessWait: Duration = .seconds(5)
    public static let taskLimit = 10
    public static let spokenTitleLimit = 3
}
