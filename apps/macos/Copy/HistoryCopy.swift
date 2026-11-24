enum HistoryCopy {
    static let ownerAdded = "You added it"
    static let ownerMoved = "You moved it"
    static let ownerCompleted = "You completed it"
    static let ownerReopened = "You reopened it"
    static let fieldTitle = "the title"
    static let fieldNotes = "the notes"
    static let fieldDueDate = "the due date"
    static let fieldOrder = "the order"

    static func agentAdded(client: String) -> String {
        "Added via \(client)"
    }

    static func ownerChanged(fields: String) -> String {
        "You changed \(fields)"
    }

    static func agentChanged(fields: String, client: String) -> String {
        "Changed \(fields) via \(client)"
    }

    static func agentMoved(client: String) -> String {
        "Moved via \(client)"
    }

    static func agentCompleted(client: String) -> String {
        "Completed via \(client)"
    }

    static func agentReopened(client: String) -> String {
        "Reopened via \(client)"
    }
}
