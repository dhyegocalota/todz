import Foundation

private let secondsPerMinute: TimeInterval = 60
private let secondsPerHour = 60 * secondsPerMinute
private let secondsPerDay = 24 * secondsPerHour
private let yesterdayDays = 1

public enum ActivityRecency: Equatable, Sendable {
    case justNow
    case minutes(Int)
    case hours(Int)
    case yesterday
    case days(Int)

    public init?(lastActivityAt: Date?, now: Date) {
        guard let lastActivityAt else { return nil }
        let elapsed = now.timeIntervalSince(lastActivityAt)
        let elapsedDays = Int(elapsed / secondsPerDay)
        guard elapsed >= secondsPerMinute else {
            self = .justNow
            return
        }
        guard elapsed >= secondsPerHour else {
            self = .minutes(Int(elapsed / secondsPerMinute))
            return
        }
        guard elapsed >= secondsPerDay else {
            self = .hours(Int(elapsed / secondsPerHour))
            return
        }
        guard elapsedDays != yesterdayDays else {
            self = .yesterday
            return
        }
        self = .days(elapsedDays)
    }
}
