import TodzKit

enum HistoryCopy {
    static var ownerAdded: String { Localized.text("You added it") }
    static var ownerMoved: String { Localized.text("You moved it") }
    static var ownerCompleted: String { Localized.text("You completed it") }
    static var ownerReopened: String { Localized.text("You reopened it") }
    static var ownerChangedSeveral: String { Localized.text("You changed several details") }

    static func agentAdded(client: String) -> String {
        Localized.text("Added via \(client)")
    }

    static func ownerChanged(field: TaskField) -> String {
        switch field {
        case .title: Localized.text("You changed the title")
        case .notes: Localized.text("You changed the notes")
        case .dueDate: Localized.text("You changed the due date")
        case .order: ownerMoved
        }
    }

    static func agentChanged(field: TaskField, client: String) -> String {
        switch field {
        case .title: Localized.text("Changed the title via \(client)")
        case .notes: Localized.text("Changed the notes via \(client)")
        case .dueDate: Localized.text("Changed the due date via \(client)")
        case .order: agentMoved(client: client)
        }
    }

    static func agentChangedSeveral(client: String) -> String {
        Localized.text("Changed several details via \(client)")
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
