import TodzKit

extension HistoryEntry {
    var sentence: String {
        let isMoveOnly = fields == [.order]
        let fieldNames = fields.map(\.copy).formatted(.list(type: .and))
        switch action {
        case .created:
            return actor.line(owner: HistoryCopy.ownerAdded) { HistoryCopy.agentAdded(client: $0) }
        case .updated where isMoveOnly:
            return actor.line(owner: HistoryCopy.ownerMoved) { HistoryCopy.agentMoved(client: $0) }
        case .updated:
            return actor.line(owner: HistoryCopy.ownerChanged(fields: fieldNames)) { HistoryCopy.agentChanged(fields: fieldNames, client: $0) }
        case .completed:
            return actor.line(owner: HistoryCopy.ownerCompleted) { HistoryCopy.agentCompleted(client: $0) }
        case .reopened:
            return actor.line(owner: HistoryCopy.ownerReopened) { HistoryCopy.agentReopened(client: $0) }
        }
    }
}
