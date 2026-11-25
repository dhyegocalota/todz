import Foundation

private let textFormat = "%04d-%02d-%02d"
private let startFailure = "a Gregorian calendar date always has a start"
private let arithmeticFailure = "a Gregorian calendar date always moves by whole days"

func gregorianCalendar(in timeZone: TimeZone) -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar
}

public struct CalendarDate: Codable, Sendable, Hashable, Comparable {
    public let year: Int
    public let month: Int
    public let day: Int

    public static func < (lhs: CalendarDate, rhs: CalendarDate) -> Bool {
        [lhs.year, lhs.month, lhs.day].lexicographicallyPrecedes([rhs.year, rhs.month, rhs.day])
    }

    public static func today(in timeZone: TimeZone, at instant: Date) -> CalendarDate {
        let calendar = gregorianCalendar(in: timeZone)
        return CalendarDate(
            year: calendar.component(.year, from: instant),
            month: calendar.component(.month, from: instant),
            day: calendar.component(.day, from: instant)
        )
    }

    public init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    public init?(text: String) {
        guard let match = text.wholeMatch(of: /([0-9]{4})-([0-9]{2})-([0-9]{2})/) else { return nil }
        guard let year = Int(match.1), let month = Int(match.2), let day = Int(match.3) else { return nil }
        let components = DateComponents(calendar: gregorianCalendar(in: .gmt), year: year, month: month, day: day)
        guard components.isValidDate else { return nil }
        self.init(year: year, month: month, day: day)
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        let text = try container.decode(String.self)
        guard let date = CalendarDate(text: text) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "a due date is not a calendar date")
        }
        self = date
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(text)
    }

    public var text: String {
        String(format: textFormat, year, month, day)
    }

    public func start(in timeZone: TimeZone) -> Date {
        let components = DateComponents(year: year, month: month, day: day)
        guard let start = gregorianCalendar(in: timeZone).date(from: components) else { preconditionFailure(startFailure) }
        return start
    }

    public func adding(days: Int) -> CalendarDate {
        let moved = gregorianCalendar(in: .gmt).date(byAdding: .day, value: days, to: start(in: .gmt))
        guard let moved else { preconditionFailure(arithmeticFailure) }
        return CalendarDate.today(in: .gmt, at: moved)
    }

    public func days(since earlier: CalendarDate) -> Int {
        let difference = gregorianCalendar(in: .gmt).dateComponents([.day], from: earlier.start(in: .gmt), to: start(in: .gmt))
        guard let days = difference.day else { preconditionFailure(arithmeticFailure) }
        return days
    }
}
