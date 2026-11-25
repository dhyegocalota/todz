import Foundation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 25)

struct DayTemperatureMoment: Sendable, CustomTestStringConvertible {
    let hour: Int
    let minute: Int
    let second: Int
    let step: DayTemperatureStep

    var testDescription: String {
        String(format: "%02d:%02d:%02d is %@", hour, minute, second, String(describing: step))
    }
}

private let moments: [DayTemperatureMoment] = [
    DayTemperatureMoment(hour: 0, minute: 0, second: 0, step: .plain),
    DayTemperatureMoment(hour: 11, minute: 59, second: 59, step: .plain),
    DayTemperatureMoment(hour: 12, minute: 0, second: 0, step: .noon),
    DayTemperatureMoment(hour: 14, minute: 59, second: 59, step: .noon),
    DayTemperatureMoment(hour: 15, minute: 0, second: 0, step: .afternoon),
    DayTemperatureMoment(hour: 17, minute: 59, second: 59, step: .afternoon),
    DayTemperatureMoment(hour: 18, minute: 0, second: 0, step: .evening),
    DayTemperatureMoment(hour: 23, minute: 59, second: 59, step: .evening),
]

private func zone(_ identifier: String = harnessTimeZoneIdentifier) throws -> TimeZone {
    try #require(TimeZone(identifier: identifier))
}

private func instant(_ day: CalendarDate, moment: DayTemperatureMoment, timeZone: TimeZone) throws -> Date {
    let components = DateComponents(year: day.year, month: day.month, day: day.day, hour: moment.hour, minute: moment.minute, second: moment.second)
    return try #require(gregorianCalendar(in: timeZone).date(from: components))
}

@Suite struct DayTemperatureStepTests {
    @Test(arguments: moments)
    func theStepFollowsTheClockOfTheGivenZone(moment: DayTemperatureMoment) throws {
        let timeZone = try zone()
        #expect(DayTemperatureStep.step(at: try instant(today, moment: moment, timeZone: timeZone), in: timeZone) == moment.step)
    }
}
