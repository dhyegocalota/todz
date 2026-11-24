import Foundation
import Testing
@testable import TodzKit

private let lastSecondOfTheTwentyThird = Date(timeIntervalSince1970: 1_795_489_199)
private let firstSecondOfTheTwentyFourth = Date(timeIntervalSince1970: 1_795_489_200)

@Suite struct CalendarDateTests {
    @Test func parsesAFullDate() {
        #expect(CalendarDate(text: "2026-11-24") == CalendarDate(year: 2026, month: 11, day: 24))
    }

    @Test(arguments: ["2026-02-30", "2026-1-5", "", "2026-11-24T00:00", "2026-13-01", "２０２６-11-24"])
    func refusesWhatIsNotACalendarDate(text: String) {
        #expect(CalendarDate(text: text) == nil)
    }

    @Test func formatsBackToTheSameText() {
        #expect(CalendarDate(year: 2026, month: 1, day: 5).text == "2026-01-05")
        #expect(CalendarDate(text: "2026-11-24")?.text == "2026-11-24")
    }

    @Test func ordersByYearThenMonthThenDay() {
        let dates = [
            CalendarDate(year: 2027, month: 1, day: 1),
            CalendarDate(year: 2026, month: 11, day: 24),
            CalendarDate(year: 2026, month: 2, day: 28),
            CalendarDate(year: 2026, month: 11, day: 3),
        ]
        #expect(dates.sorted().map(\.text) == ["2026-02-28", "2026-11-03", "2026-11-24", "2027-01-01"])
    }

    @Test func answersTheZonesDateAtBothSidesOfMidnight() throws {
        let saoPaulo = try #require(TimeZone(identifier: "America/Sao_Paulo"))
        #expect(CalendarDate.today(in: saoPaulo, at: lastSecondOfTheTwentyThird) == CalendarDate(year: 2026, month: 11, day: 23))
        #expect(CalendarDate.today(in: saoPaulo, at: firstSecondOfTheTwentyFourth) == CalendarDate(year: 2026, month: 11, day: 24))
    }

    @Test func answersAnotherDateInAnotherZoneAtTheSameInstant() throws {
        let tokyo = try #require(TimeZone(identifier: "Asia/Tokyo"))
        #expect(CalendarDate.today(in: tokyo, at: lastSecondOfTheTwentyThird) == CalendarDate(year: 2026, month: 11, day: 24))
    }
}
