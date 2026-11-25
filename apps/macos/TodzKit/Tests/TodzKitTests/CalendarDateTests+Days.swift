import Foundation
import Testing
@testable import TodzKit

private let firstSecondOfTheTwentyFourthInSaoPaulo = Date(timeIntervalSince1970: 1_795_489_200)

extension CalendarDateTests {
    @Test func startsAtMidnightInTheGivenZone() throws {
        let saoPaulo = try #require(TimeZone(identifier: "America/Sao_Paulo"))
        #expect(CalendarDate(year: 2026, month: 11, day: 24).start(in: saoPaulo) == firstSecondOfTheTwentyFourthInSaoPaulo)
    }

    @Test func addsDaysAcrossMonthsAndYears() {
        #expect(CalendarDate(year: 2026, month: 11, day: 24).adding(days: 1) == CalendarDate(year: 2026, month: 11, day: 25))
        #expect(CalendarDate(year: 2026, month: 12, day: 31).adding(days: 1) == CalendarDate(year: 2027, month: 1, day: 1))
        #expect(CalendarDate(year: 2026, month: 3, day: 1).adding(days: -1) == CalendarDate(year: 2026, month: 2, day: 28))
        #expect(CalendarDate(year: 2028, month: 3, day: 1).adding(days: -1) == CalendarDate(year: 2028, month: 2, day: 29))
    }

    @Test func theSameDayIsZeroDaysSince() {
        #expect(CalendarDate(year: 2026, month: 11, day: 25).days(since: CalendarDate(year: 2026, month: 11, day: 25)) == 0)
    }

    @Test func theNextDayIsOneDaySince() {
        #expect(CalendarDate(year: 2026, month: 11, day: 25).days(since: CalendarDate(year: 2026, month: 11, day: 24)) == 1)
    }

    @Test func theDaysOfADaylightSavingChangeAreStillOneDayApart() {
        let springForward = CalendarDate(year: 2026, month: 3, day: 8)
        let fallBack = CalendarDate(year: 2026, month: 11, day: 1)
        #expect(springForward.days(since: springForward.adding(days: -1)) == 1)
        #expect(springForward.adding(days: 1).days(since: springForward) == 1)
        #expect(fallBack.days(since: fallBack.adding(days: -1)) == 1)
        #expect(fallBack.adding(days: 1).days(since: fallBack) == 1)
    }

    @Test func aYearApartIsThreeHundredSixtyFiveDaysSince() {
        #expect(CalendarDate(year: 2027, month: 11, day: 25).days(since: CalendarDate(year: 2026, month: 11, day: 25)) == 365)
    }
}
