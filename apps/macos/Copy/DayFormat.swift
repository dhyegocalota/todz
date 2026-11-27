import Foundation
import TodzKit

enum DayFormat {
    static func full(day: CalendarDate, timeZone: TimeZone) -> String {
        day.start(in: timeZone).formatted(Date.FormatStyle(date: .complete, time: .omitted, locale: Localized.locale, timeZone: timeZone))
    }

    static func short(day: CalendarDate, today: CalendarDate, timeZone: TimeZone) -> String {
        let dayAndMonth = Date.FormatStyle(locale: Localized.locale, timeZone: timeZone).day().month(.wide)
        let isThisYear = day.year == today.year
        let style = isThisYear ? dayAndMonth : dayAndMonth.year()
        return day.start(in: timeZone).formatted(style)
    }

    static func moment(instant: Date, timeZone: TimeZone) -> String {
        instant.formatted(Date.FormatStyle(date: .abbreviated, time: .shortened, locale: Localized.locale, timeZone: timeZone))
    }
}
