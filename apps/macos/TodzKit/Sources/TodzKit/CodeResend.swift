import Foundation

public enum CodeResend {
    public static let cooldown: TimeInterval = 30

    public static func remainingSeconds(sentAt: Date, now: Date) -> Int? {
        let remaining = sentAt.addingTimeInterval(cooldown).timeIntervalSince(now)
        guard remaining > 0 else { return nil }
        return Int(remaining.rounded(.up))
    }
}
