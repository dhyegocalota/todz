import Foundation
import Testing
@testable import TodzKit

private let evening = 18 * 60
private let laterEvening = 20 * 60
private let insideTheSpringGap = 2 * 60 + 30
private let today = CalendarDate(year: 2026, month: 11, day: 25)
private let yesterday = today.adding(days: -1)
private let tomorrow = today.adding(days: 1)
private let springForward = CalendarDate(year: 2026, month: 3, day: 8)
private let fallBack = CalendarDate(year: 2026, month: 11, day: 1)
private let newYork = "America/New_York"

private func zone(_ identifier: String = harnessTimeZoneIdentifier) throws -> TimeZone {
    try #require(TimeZone(identifier: identifier))
}

private func instant(_ day: CalendarDate, hour: Int, minute: Int = 0, timeZone: TimeZone) throws -> Date {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return try #require(calendar.date(from: DateComponents(year: day.year, month: day.month, day: day.day, hour: hour, minute: minute)))
}

private func decision(
    at now: Date,
    minutesAfterMidnight: Int = evening,
    lastClosedDay: CalendarDate? = nil,
    isOn: Bool = true,
    timeZone: TimeZone
) -> DayCloseDecision {
    DayCloseSchedule.decision(at: now, minutesAfterMidnight: minutesAfterMidnight, lastClosedDay: lastClosedDay, isOn: isOn, timeZone: timeZone)
}

@Suite struct DayCloseScheduleTests {
    @Test func aTurnedOffDayCloseIsOff() throws {
        let timeZone = try zone()
        #expect(decision(at: try instant(today, hour: 19, timeZone: timeZone), isOn: false, timeZone: timeZone) == .off)
    }

    @Test func beforeTheTimeItIsNotYetAndLooksAgainAtTheTimeToday() throws {
        let timeZone = try zone()
        let expected = DayCloseDecision.notYet(next: try instant(today, hour: 18, timeZone: timeZone))
        #expect(decision(at: try instant(today, hour: 17, timeZone: timeZone), lastClosedDay: yesterday, timeZone: timeZone) == expected)
    }

    @Test(arguments: [18, 21])
    func atTheTimeAndAfterItTheSameDayItIsDue(hour: Int) throws {
        let timeZone = try zone()
        #expect(decision(at: try instant(today, hour: hour, timeZone: timeZone), lastClosedDay: yesterday, timeZone: timeZone) == .due)
    }

    @Test func aDayAlreadyClosedIsDoneAndLooksAgainTomorrowAtTheTime() throws {
        let timeZone = try zone()
        let expected = DayCloseDecision.doneToday(next: try instant(tomorrow, hour: 18, timeZone: timeZone))
        #expect(decision(at: try instant(today, hour: 21, timeZone: timeZone), lastClosedDay: today, timeZone: timeZone) == expected)
    }

    @Test func aMissedTimeIsDueUntilTheDayEnds() throws {
        let timeZone = try zone()
        #expect(decision(at: try instant(today, hour: 23, minute: 59, timeZone: timeZone), lastClosedDay: yesterday, timeZone: timeZone) == .due)
    }

    @Test func aMissedTimeIsNotCarriedIntoTheNextDay() throws {
        let timeZone = try zone()
        let expected = DayCloseDecision.notYet(next: try instant(tomorrow, hour: 18, timeZone: timeZone))
        #expect(decision(at: try instant(tomorrow, hour: 0, minute: 1, timeZone: timeZone), lastClosedDay: yesterday, timeZone: timeZone) == expected)
    }

    @Test func aLaterTimeChosenAfterClosingTodayWaitsForTomorrow() throws {
        let timeZone = try zone()
        let now = try instant(today, hour: 19, timeZone: timeZone)
        let expected = DayCloseDecision.doneToday(next: try instant(tomorrow, hour: 20, timeZone: timeZone))
        #expect(decision(at: now, minutesAfterMidnight: laterEvening, lastClosedDay: today, timeZone: timeZone) == expected)
    }

    @Test func turnedOnAfterTodaysTimeItIsDueAtOnce() throws {
        let timeZone = try zone()
        #expect(decision(at: try instant(today, hour: 19, timeZone: timeZone), timeZone: timeZone) == .due)
    }

    @Test(arguments: [springForward, fallBack])
    func aDaylightSavingDayKeepsTheWallClockTime(day: CalendarDate) throws {
        let timeZone = try zone(newYork)
        let expected = DayCloseDecision.notYet(next: try instant(day, hour: 18, timeZone: timeZone))
        #expect(decision(at: try instant(day, hour: 17, minute: 59, timeZone: timeZone), timeZone: timeZone) == expected)
        #expect(decision(at: try instant(day, hour: 18, timeZone: timeZone), timeZone: timeZone) == .due)
    }

    @Test func aTimeInsideTheSpringGapIsDueAtTheFirstWallClockInstantAfterIt() throws {
        let timeZone = try zone(newYork)
        let halfPastThree = try instant(springForward, hour: 3, minute: 30, timeZone: timeZone)
        let now = try instant(springForward, hour: 1, timeZone: timeZone)
        #expect(decision(at: now, minutesAfterMidnight: insideTheSpringGap, timeZone: timeZone) == .notYet(next: halfPastThree))
        #expect(decision(at: halfPastThree, minutesAfterMidnight: insideTheSpringGap, timeZone: timeZone) == .due)
    }

    @Test func aTimeOfDayRoundTripsThroughAnInstant() throws {
        let timeZone = try zone()
        let closing = DayCloseSchedule.instant(day: today, minutesAfterMidnight: laterEvening, timeZone: timeZone)
        #expect(closing == (try instant(today, hour: 20, timeZone: timeZone)))
        #expect(DayCloseSchedule.minutesAfterMidnight(of: closing, timeZone: timeZone) == laterEvening)
    }
}
