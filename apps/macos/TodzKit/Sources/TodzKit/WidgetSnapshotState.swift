enum WidgetSnapshotState: Equatable, Sendable {
    case loading
    case absent
    case ready(WidgetSnapshot)
}
