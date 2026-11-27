import TodzKit

extension HistoryEntry {
    var sentence: String {
        let isMoveOnly = fields == [.order]
        switch action {
        case .created:
            return actor.line(owner: HistoryCopy.ownerAdded) { HistoryCopy.agentAdded(client: $0) }
        case .updated where isMoveOnly:
            return actor.line(owner: HistoryCopy.ownerMoved) { HistoryCopy.agentMoved(client: $0) }
        case .updated:
            guard fields.count == 1, let field = fields.first else {
                return actor.line(owner: HistoryCopy.ownerChangedSeveral) { HistoryCopy.agentChangedSeveral(client: $0) }
            }
            return actor.line(owner: HistoryCopy.ownerChanged(field: field)) { HistoryCopy.agentChanged(field: field, client: $0) }
        case .completed:
            return actor.line(owner: HistoryCopy.ownerCompleted) { HistoryCopy.agentCompleted(client: $0) }
        case .reopened:
            return actor.line(owner: HistoryCopy.ownerReopened) { HistoryCopy.agentReopened(client: $0) }
        }
    }
}
