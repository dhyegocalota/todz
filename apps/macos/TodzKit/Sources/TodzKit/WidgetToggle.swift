import Foundation

public enum WidgetToggle {
    // NB ADR 0033: a checkbox carries its target state, so a tap on a row the app has since redrawn never inverts it.
    public static func setting(
        _ snapshot: WidgetSnapshot,
        projectIdentifier: String,
        number: Int,
        to state: TaskState,
        at instant: Date
    ) -> (snapshot: WidgetSnapshot, request: WidgetRequest)? {
        let isToggled = { (task: WidgetSnapshotTask) in task.projectIdentifier == projectIdentifier && task.number == number }
        let toggled = (snapshot.open + snapshot.doneToday).first(where: isToggled)
        guard let toggled, toggled.state != state else { return nil }
        let setInPlace = { (task: WidgetSnapshotTask) in isToggled(task) ? task.setting(state: state) : task }
        let changed = WidgetSnapshot(
            workspaceName: snapshot.workspaceName,
            day: snapshot.day,
            timeZoneIdentifier: snapshot.timeZoneIdentifier,
            open: snapshot.open.map(setInPlace),
            pending: snapshot.pending,
            doneToday: snapshot.doneToday.map(setInPlace),
            showsDayTemperature: snapshot.showsDayTemperature
        )
        let request = WidgetRequest(projectIdentifier: projectIdentifier, number: number, state: state, at: instant)
        return (snapshot: changed, request: request)
    }
}
