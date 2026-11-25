import Foundation
import TodzKit
import WidgetKit

private let daysToNextMidnight = 1

struct TodayEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?

    var widgetDay: WidgetDay? {
        guard let snapshot, let timeZone = TimeZone(identifier: snapshot.timeZoneIdentifier) else { return nil }
        return WidgetDay(day: CalendarDate.today(in: timeZone, at: date), timeZone: timeZone)
    }

    var showsDayTemperature: Bool {
        snapshot?.showsDayTemperature == true
    }

    var nextMidnight: Date? {
        guard let widgetDay else { return nil }
        return widgetDay.day.adding(days: daysToNextMidnight).start(in: widgetDay.timeZone)
    }

    func content(of family: WidgetFamilyKind) -> WidgetContent {
        guard let widgetDay else { return .prompt }
        return WidgetContent.of(snapshot: snapshot, family: family, on: widgetDay.day)
    }
}
