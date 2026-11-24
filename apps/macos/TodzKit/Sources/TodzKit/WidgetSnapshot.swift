import Foundation

public struct WidgetSnapshot: Codable, Equatable, Sendable {
    public let workspaceName: String
    public let day: CalendarDate
    public let timeZoneIdentifier: String
    public let open: [WidgetSnapshotTask]
    public let pending: [WidgetSnapshotTask]
    public let doneToday: [WidgetSnapshotTask]

    public init(
        workspaceName: String,
        day: CalendarDate,
        timeZoneIdentifier: String,
        open: [WidgetSnapshotTask],
        pending: [WidgetSnapshotTask],
        doneToday: [WidgetSnapshotTask]
    ) {
        self.workspaceName = workspaceName
        self.day = day
        self.timeZoneIdentifier = timeZoneIdentifier
        self.open = open
        self.pending = pending
        self.doneToday = doneToday
    }

    public static func of(views: TaskViews, workspace: Workspace, day: CalendarDate, timeZone: TimeZone) -> WidgetSnapshot {
        fatalError("WidgetSnapshot.of is not implemented")
    }

    public func isCurrent(on day: CalendarDate) -> Bool {
        fatalError("WidgetSnapshot.isCurrent is not implemented")
    }
}
