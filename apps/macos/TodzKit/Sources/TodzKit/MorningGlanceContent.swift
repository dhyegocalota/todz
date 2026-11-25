public struct MorningGlanceContent: Equatable, Sendable {
    // NB ADR 0062: the panel lists at most five of Today's open tasks and counts the rest.
    static let rowLimit = 5

    public let workspaceIdentifier: String
    public let openCount: Int
    public let rows: [WidgetSnapshotTask]
    public let restCount: Int
}
