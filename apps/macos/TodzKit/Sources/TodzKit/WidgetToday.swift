public struct WidgetToday: Equatable, Sendable {
    public let workspaceName: String
    public let rows: [WidgetSnapshotTask]
    public let nextUp: WidgetSnapshotTask?
    public let openCount: Int
    public let doneCount: Int

    public var totalCount: Int {
        openCount + doneCount
    }

    public var isAllDone: Bool {
        nextUp == nil
    }

    public var progress: Double {
        guard totalCount > 0 else { return 0 }
        return Double(doneCount) / Double(totalCount)
    }
}
