enum HistoryCopy {
    static var ownerAdded: String { Localized.text("You added it") }
    static var ownerMoved: String { Localized.text("You moved it") }
    static var ownerCompleted: String { Localized.text("You completed it") }
    static var ownerReopened: String { Localized.text("You reopened it") }
    static var fieldTitle: String { Localized.text("the title") }
    static var fieldNotes: String { Localized.text("the notes") }
    static var fieldDueDate: String { Localized.text("the due date") }
    static var fieldOrder: String { Localized.text("the order") }

    static func agentAdded(client: String) -> String {
        Localized.text("Added via \(client)")
    }

    static func ownerChanged(fields: String) -> String {
        Localized.text("You changed \(fields)")
    }

    static func agentChanged(fields: String, client: String) -> String {
        Localized.text("Changed \(fields) via \(client)")
    }

    static func agentMoved(client: String) -> String {
        Localized.text("Moved via \(client)")
    }

    static func agentCompleted(client: String) -> String {
        Localized.text("Completed via \(client)")
    }

    static func agentReopened(client: String) -> String {
        Localized.text("Reopened via \(client)")
    }
}
