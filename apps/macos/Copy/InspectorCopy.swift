enum InspectorCopy {
    static let project = "Project"
    static let due = "Due"
    static let added = "Added"
    static let completed = "Completed"
    static let notes = "Notes"
    static let history = "History"
    static let noDueDate = "None"
    static let clearDueDate = "Clear"
    static let notesPlaceholder = "Add notes"
    static let noSelection = "No task selected"
    static let noSelectionBody = "Select a task to see its details."
    static let historyFailed = "Couldn't load the history."
    static let historyOffline = "History shows when todz is back online."

    static func byYou(time: String) -> String {
        "\(time) by you"
    }

    static func viaClient(time: String, client: String) -> String {
        "\(time) via \(client)"
    }
}
