import Foundation

private let workspaceNameSeparator = ", "

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
        workspaces: [Workspace],
        day: CalendarDate,
        timeZone: TimeZone,
        showsDayTemperature: Bool
    ) -> WidgetSnapshot {
        let today = views.today
        let isWorkspaceTagged = workspaces.count > 1
        let workspaceOfProject = { (projectIdentifier: String) in
            workspaces.first { workspace in workspace.projects.contains { $0.identifier == projectIdentifier } }
        }
        let rows = { (boardTasks: [BoardTask]) in
            boardTasks.compactMap { boardTask in
                workspaceOfProject(boardTask.project.identifier).map { WidgetSnapshotTask.of(boardTask, workspace: $0, isWorkspaceTagged: isWorkspaceTagged, day: day) }
            }
        }
        let pending = views.pendingTasks(for: .today).compactMap { pendingTask in
            workspaceOfProject(pendingTask.projectIdentifier).flatMap { workspace in
                workspace.projects
                    .first { $0.identifier == pendingTask.projectIdentifier }
                    .map { WidgetSnapshotTask.of(pendingTask, project: $0, workspace: workspace, isWorkspaceTagged: isWorkspaceTagged, day: day) }
            }
        }
        return WidgetSnapshot(
            workspaceName: workspaces.map(\.name).joined(separator: workspaceNameSeparator),
            day: day,
            timeZoneIdentifier: timeZone.identifier,
            open: rows(today.open),
            pending: pending,
            doneToday: rows(today.doneToday),
            showsDayTemperature: showsDayTemperature
        )
    }

    public var isMultiWorkspace: Bool {
        let workspaceIdentifiers = Set((open + pending + doneToday).compactMap(\.workspaceIdentifier))
        return workspaceIdentifiers.count > 1
    }

    public func isCurrent(on day: CalendarDate) -> Bool {
        self.day == day
    }
}
