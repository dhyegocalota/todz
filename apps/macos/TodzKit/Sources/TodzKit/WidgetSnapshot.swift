import Foundation

public struct WidgetSnapshot: Codable, Equatable, Sendable {
    public let workspaceName: String
    public let day: CalendarDate
    public let timeZoneIdentifier: String
    public let open: [WidgetSnapshotTask]
    public let pending: [WidgetSnapshotTask]
    public let doneToday: [WidgetSnapshotTask]
    public let showsDayTemperature: Bool

    public init(
        workspaceName: String,
        day: CalendarDate,
        timeZoneIdentifier: String,
        open: [WidgetSnapshotTask],
        pending: [WidgetSnapshotTask],
        doneToday: [WidgetSnapshotTask],
        showsDayTemperature: Bool
    ) {
        self.workspaceName = workspaceName
        self.day = day
        self.timeZoneIdentifier = timeZoneIdentifier
        self.open = open
        self.pending = pending
        self.doneToday = doneToday
        self.showsDayTemperature = showsDayTemperature
    }

    public static func of(
        views: TaskViews,
        workspace: Workspace,
        day: CalendarDate,
        timeZone: TimeZone,
        showsDayTemperature: Bool
    ) -> WidgetSnapshot {
        let today = views.today
        let pending = views.pendingTasks(for: .today).compactMap { pendingTask in
            workspace.projects
                .first { $0.identifier == pendingTask.projectIdentifier }
                .map { WidgetSnapshotTask.of(pendingTask, project: $0, day: day) }
        }
        return WidgetSnapshot(
            workspaceName: workspace.name,
            day: day,
            timeZoneIdentifier: timeZone.identifier,
            open: today.open.map { WidgetSnapshotTask.of($0, day: day) },
            pending: pending,
            doneToday: today.doneToday.map { WidgetSnapshotTask.of($0, day: day) },
            showsDayTemperature: showsDayTemperature
        )
    }

    public func isCurrent(on day: CalendarDate) -> Bool {
        self.day == day
    }
}
