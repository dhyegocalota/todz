import TodzKit

extension HistoryEntry {
    var sentence: String? {
        guard let source = ChangeSource(actor) else { return nil }
        let isMoveOnly = fields == [.order]
        let fieldNames = fields.map(\.copy).formatted(.list(type: .and))
        switch action {
        case .created:
            return source.line(owner: HistoryCopy.ownerAdded) { HistoryCopy.agentAdded(client: $0) }
        case .updated where isMoveOnly:
            return source.line(owner: HistoryCopy.ownerMoved) { HistoryCopy.agentMoved(client: $0) }
        case .updated:
            return source.line(owner: HistoryCopy.ownerChanged(fields: fieldNames)) { HistoryCopy.agentChanged(fields: fieldNames, client: $0) }
        case .completed:
            return source.line(owner: HistoryCopy.ownerCompleted) { HistoryCopy.agentCompleted(client: $0) }
        case .reopened:
            return source.line(owner: HistoryCopy.ownerReopened) { HistoryCopy.agentReopened(client: $0) }
        }
    }
}
