import Foundation

public enum ActivityRecency: Equatable, Sendable {
    case justNow
    case minutes(Int)
    case hours(Int)
    case yesterday
    case days(Int)

    public init?(lastActivityAt: Date?, now: Date) {
        return nil
    }
}
