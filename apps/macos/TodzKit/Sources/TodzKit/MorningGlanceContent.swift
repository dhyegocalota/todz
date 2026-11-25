public struct MorningGlanceContent: Equatable, Sendable {
    public let workspaceIdentifier: String
    public let openCount: Int
    public let rows: [WidgetSnapshotTask]
    public let restCount: Int
}
