import Foundation

private let secondsPerMinute: TimeInterval = 60

public enum WorkspaceLockTimeout: Int, CaseIterable, Sendable {
    case oneMinute = 1
    case fiveMinutes = 5
    case fifteenMinutes = 15
    case oneHour = 60

    // NB ADR 0110: the session relocks after five idle minutes until the owner picks another time.
    public static let standard = WorkspaceLockTimeout.fiveMinutes

    public var seconds: TimeInterval {
        TimeInterval(rawValue) * secondsPerMinute
    }
}
