import Foundation
import Testing
@testable import TodzKit

private let minute: TimeInterval = 60
private let hour = 60 * minute
private let day = 24 * hour

private func recency(secondsAgo: TimeInterval) -> ActivityRecency? {
    ActivityRecency(lastActivityAt: fixedInstant.addingTimeInterval(-secondsAgo), now: fixedInstant)
}

@Suite struct ActivityRecencyTests {
    @Test func aWorkspaceWithoutAStampHasNoRecency() {
        #expect(ActivityRecency(lastActivityAt: nil, now: fixedInstant) == nil)
    }

    @Test(arguments: [0, 59])
    func underAMinuteIsJustNow(secondsAgo: TimeInterval) {
        #expect(recency(secondsAgo: secondsAgo) == .justNow)
    }

    @Test func aStampInTheFutureIsJustNow() {
        #expect(recency(secondsAgo: -5 * minute) == .justNow)
    }

    @Test(arguments: [(minute, 1), (45 * minute, 45), (hour - 1, 59)])
    func underAnHourCountsMinutes(secondsAgo: TimeInterval, minutes: Int) {
        #expect(recency(secondsAgo: secondsAgo) == .minutes(minutes))
    }

    @Test(arguments: [(hour, 1), (5 * hour + 30 * minute, 5), (day - 1, 23)])
    func underADayCountsHours(secondsAgo: TimeInterval, hours: Int) {
        #expect(recency(secondsAgo: secondsAgo) == .hours(hours))
    }

    @Test(arguments: [day, 2 * day - 1])
    func theDayBeforeIsYesterday(secondsAgo: TimeInterval) {
        #expect(recency(secondsAgo: secondsAgo) == .yesterday)
    }

    @Test(arguments: [(2 * day, 2), (9 * day + hour, 9), (400 * day, 400)])
    func olderCountsDays(secondsAgo: TimeInterval, days: Int) {
        #expect(recency(secondsAgo: secondsAgo) == .days(days))
    }
}
