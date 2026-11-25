import Foundation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 25)
private let minutesPerHour = 60
private let closeAtSix = 18 * minutesPerHour
private let chainedBoundaries = 6

private func zone(_ identifier: String) throws -> TimeZone {
    try #require(TimeZone(identifier: identifier))
}

private func utc(_ text: String) throws -> Date {
    try #require(ISO8601DateFormatter().date(from: text))
}

private func local(_ day: CalendarDate, hour: Int, minute: Int = 0, second: TimeInterval = 0, in timeZone: TimeZone) -> Date {
    DayCloseSchedule.instant(day: day, minutesAfterMidnight: hour * minutesPerHour + minute, timeZone: timeZone).addingTimeInterval(second)
}

private func hourly(after instant: Date, in timeZone: TimeZone) -> Date? {
    RibbonSchedule.nextShowing(after: instant, cadence: .hourly, closeMinutesAfterMidnight: nil, timeZone: timeZone)
}

private func dayClose(after instant: Date, minutes: Int?, in timeZone: TimeZone) -> Date? {
    RibbonSchedule.nextShowing(after: instant, cadence: .dayClose, closeMinutesAfterMidnight: minutes, timeZone: timeZone)
}

@Suite struct RibbonScheduleTests {
    @Test func hourlyAfterTwentyPastTenIsTheNextHourTheSameDay() throws {
        let saoPaulo = try zone("America/Sao_Paulo")
        let after = local(today, hour: 10, minute: 20, second: 5, in: saoPaulo)
        #expect(hourly(after: after, in: saoPaulo) == local(today, hour: 11, in: saoPaulo))
    }

    @Test func hourlyExactlyOnTheHourIsTheNextHour() throws {
        let saoPaulo = try zone("America/Sao_Paulo")
        #expect(hourly(after: local(today, hour: 11, in: saoPaulo), in: saoPaulo) == local(today, hour: 12, in: saoPaulo))
    }

    @Test func hourlyAfterHalfPastElevenIsMidnightOfTheNextDay() throws {
        let saoPaulo = try zone("America/Sao_Paulo")
        let after = local(today, hour: 23, minute: 30, in: saoPaulo)
        #expect(hourly(after: after, in: saoPaulo) == local(today.adding(days: 1), hour: 0, in: saoPaulo))
    }

    @Test func hourlyAcrossTheSpringForwardSkipsTheHourThatDoesNotExist() throws {
        let newYork = try zone("America/New_York")
        let next = hourly(after: try utc("2026-03-08T06:30:00Z"), in: newYork)
        #expect(next == (try utc("2026-03-08T07:00:00Z")))
    }

    @Test func hourlyAcrossTheFallBackReturnsTheSecondOneOClockOnce() throws {
        let newYork = try zone("America/New_York")
        let firstPass = try utc("2026-11-01T05:30:00Z")
        #expect(hourly(after: firstPass, in: newYork) == (try utc("2026-11-01T06:00:00Z")))
    }

    @Test func hourlyNeverReturnsTheSameInstantTwiceInARowAcrossTheFallBack() throws {
        let newYork = try zone("America/New_York")
        let boundaries = try (0..<chainedBoundaries).reduce(into: [try utc("2026-11-01T04:30:00Z")]) { instants, _ in
            let next = try #require(hourly(after: instants[instants.count - 1], in: newYork))
            instants.append(next)
        }
        #expect(zip(boundaries, boundaries.dropFirst()).allSatisfy { $0 < $1 })
    }

    @Test func hourlyFollowsTheZoneOfTheMacAsInstants() throws {
        let instant = try utc("2026-11-25T10:20:00Z")
        #expect(hourly(after: instant, in: try zone("America/Sao_Paulo")) == (try utc("2026-11-25T11:00:00Z")))
        #expect(hourly(after: instant, in: try zone("Asia/Kolkata")) == (try utc("2026-11-25T10:30:00Z")))
    }

    @Test func dayCloseBeforeTheCloseIsTheCloseTheSameDay() throws {
        let saoPaulo = try zone("America/Sao_Paulo")
        let after = local(today, hour: 17, minute: 59, in: saoPaulo)
        #expect(dayClose(after: after, minutes: closeAtSix, in: saoPaulo) == local(today, hour: 18, in: saoPaulo))
    }

    @Test func dayCloseExactlyAtTheCloseIsTheNextDay() throws {
        let saoPaulo = try zone("America/Sao_Paulo")
        let after = local(today, hour: 18, in: saoPaulo)
        #expect(dayClose(after: after, minutes: closeAtSix, in: saoPaulo) == local(today.adding(days: 1), hour: 18, in: saoPaulo))
    }

    @Test func dayCloseWithoutATimeIsNone() throws {
        let saoPaulo = try zone("America/Sao_Paulo")
        #expect(dayClose(after: local(today, hour: 9, in: saoPaulo), minutes: nil, in: saoPaulo) == nil)
    }

    @Test func theAgentCadenceHasNoBoundary() throws {
        let saoPaulo = try zone("America/Sao_Paulo")
        let next = RibbonSchedule.nextShowing(
            after: local(today, hour: 9, in: saoPaulo),
            cadence: .agentChange,
            closeMinutesAfterMidnight: closeAtSix,
            timeZone: saoPaulo
        )
        #expect(next == nil)
    }
}
