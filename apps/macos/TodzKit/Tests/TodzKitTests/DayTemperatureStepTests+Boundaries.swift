import Foundation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 25)
private let tomorrow = today.adding(days: 1)
private let springForward = CalendarDate(year: 2026, month: 3, day: 8)
private let fallBack = CalendarDate(year: 2026, month: 11, day: 1)
private let santiagoGapEve = CalendarDate(year: 2026, month: 9, day: 5)
private let santiagoGapDay = CalendarDate(year: 2026, month: 9, day: 6)
private let newYork = "America/New_York"
private let berlin = "Europe/Berlin"
private let santiago = "America/Santiago"
private let boundaryHours = [12, 15, 18, 0]

private func zone(_ identifier: String = harnessTimeZoneIdentifier) throws -> TimeZone {
    try #require(TimeZone(identifier: identifier))
}

private func local(_ day: CalendarDate, hour: Int, minute: Int = 0, second: Int = 0, in timeZone: TimeZone) throws -> Date {
    let components = DateComponents(year: day.year, month: day.month, day: day.day, hour: hour, minute: minute, second: second)
    return try #require(gregorianCalendar(in: timeZone).date(from: components))
}

private func hours(of instants: [Date], in timeZone: TimeZone) -> [Int] {
    instants.map { gregorianCalendar(in: timeZone).component(.hour, from: $0) }
}

extension DayTemperatureStepTests {
    @Test func aDayHasThreeStepBoundariesAndThenMidnight() throws {
        let timeZone = try zone()
        let expected = [
            try local(today, hour: 12, in: timeZone),
            try local(today, hour: 15, in: timeZone),
            try local(today, hour: 18, in: timeZone),
            try local(tomorrow, hour: 0, in: timeZone),
        ]
        #expect(DayTemperatureStep.boundaries(on: today, in: timeZone) == expected)
    }

    @Test func theNextBoundaryIsTheFirstOneAfterTheInstant() throws {
        let timeZone = try zone()
        let noon = try local(today, hour: 12, in: timeZone)
        let afternoon = try local(today, hour: 15, in: timeZone)
        let midnight = try local(tomorrow, hour: 0, in: timeZone)
        #expect(DayTemperatureStep.nextBoundary(after: try local(today, hour: 11, minute: 30, in: timeZone), in: timeZone) == noon)
        #expect(DayTemperatureStep.nextBoundary(after: noon, in: timeZone) == afternoon)
        #expect(DayTemperatureStep.nextBoundary(after: try local(today, hour: 14, minute: 59, second: 59, in: timeZone), in: timeZone) == afternoon)
        #expect(DayTemperatureStep.nextBoundary(after: try local(today, hour: 23, minute: 59, second: 59, in: timeZone), in: timeZone) == midnight)
    }

    @Test func theSpringForwardGapIsNotABoundary() throws {
        let timeZone = try zone(newYork)
        let beforeTheGap = try local(springForward, hour: 1, minute: 30, in: timeZone)
        #expect(DayTemperatureStep.nextBoundary(after: beforeTheGap, in: timeZone) == (try local(springForward, hour: 12, in: timeZone)))
        #expect(hours(of: DayTemperatureStep.boundaries(on: springForward, in: timeZone), in: timeZone) == boundaryHours)
    }

    @Test func theFallBackHourRepeatsNoBoundary() throws {
        let timeZone = try zone(newYork)
        let boundaries = DayTemperatureStep.boundaries(on: fallBack, in: timeZone)
        #expect(hours(of: boundaries, in: timeZone) == boundaryHours)
        #expect(boundaries == boundaries.sorted())
        let afternoon = try local(fallBack, hour: 15, in: timeZone)
        #expect(boundaries.filter { $0 == afternoon }.count == 1)
    }

    @Test func theBoundaryFollowsTheGivenZoneNotUniversalTime() throws {
        let instant = Date(timeIntervalSince1970: 1_795_622_400)
        let saoPaulo = try zone()
        let berlinZone = try zone(berlin)
        #expect(DayTemperatureStep.nextBoundary(after: instant, in: saoPaulo) == Date(timeIntervalSince1970: 1_795_629_600))
        #expect(DayTemperatureStep.nextBoundary(after: instant, in: berlinZone) == Date(timeIntervalSince1970: 1_795_626_000))
    }

    @Test func aZoneThatSkipsMidnightStillHasANextBoundary() throws {
        let timeZone = try zone(santiago)
        let calendar = gregorianCalendar(in: timeZone)
        let firstInstantOfTheGapDay = calendar.startOfDay(for: try local(santiagoGapDay, hour: 12, in: timeZone))
        let eveBeforeTheGap = try local(santiagoGapEve, hour: 23, in: timeZone)
        #expect(calendar.component(.hour, from: firstInstantOfTheGapDay) == 1)
        #expect(DayTemperatureStep.nextBoundary(after: eveBeforeTheGap, in: timeZone) == firstInstantOfTheGapDay)
        #expect(DayTemperatureStep.boundaries(on: santiagoGapEve, in: timeZone).last == firstInstantOfTheGapDay)
    }
}
