import Foundation
import TodzKit

private func sampleTask(number: Int, title: String, tag: String, state: TaskState, day: CalendarDate) -> WidgetSnapshotTask {
    WidgetSnapshotTask(
        projectIdentifier: tag,
        projectName: tag,
        number: number,
        title: title,
        dueDate: day,
        creatorLabel: nil,
        isOverdue: false,
        state: state
    )
}

extension TodayEntry {
    static func sample(at date: Date) -> TodayEntry {
        let timeZone = TimeZone.current
        let day = CalendarDate.today(in: timeZone, at: date)
        let open = [
            sampleTask(number: 1, title: WidgetSampleCopy.firstTitle, tag: WidgetSampleCopy.apiTag, state: .open, day: day),
            sampleTask(number: 2, title: WidgetSampleCopy.secondTitle, tag: WidgetSampleCopy.syncTag, state: .open, day: day),
            sampleTask(number: 3, title: WidgetSampleCopy.thirdTitle, tag: WidgetSampleCopy.macAppTag, state: .open, day: day),
            sampleTask(number: 4, title: WidgetSampleCopy.fourthTitle, tag: WidgetSampleCopy.macAppTag, state: .open, day: day),
            sampleTask(number: 5, title: WidgetSampleCopy.fifthTitle, tag: WidgetSampleCopy.launchTag, state: .open, day: day),
        ]
        let doneToday = [
            sampleTask(number: 6, title: WidgetSampleCopy.firstDoneTitle, tag: WidgetSampleCopy.launchTag, state: .done, day: day),
            sampleTask(number: 7, title: WidgetSampleCopy.secondDoneTitle, tag: WidgetSampleCopy.apiTag, state: .done, day: day),
        ]
        let snapshot = WidgetSnapshot(
            workspaceName: WidgetSampleCopy.workspace,
            day: day,
            timeZoneIdentifier: timeZone.identifier,
            open: open,
            pending: [],
            doneToday: doneToday
        )
        return TodayEntry(date: date, snapshot: snapshot)
    }
}
