enum InspectorCopy {
    static var project: String { Localized.text("Project") }
    static var due: String { Localized.text("Due") }
    static var added: String { Localized.text("Added") }
    static var completed: String { Localized.text("Completed") }
    static var notes: String { Localized.text("Notes") }
    static var history: String { Localized.text("History") }
    static var noDueDate: String { Localized.text("None") }
    static var clearDueDate: String { Localized.text("Clear") }
    static var notesPlaceholder: String { Localized.text("Add notes") }
    static var noSelection: String { Localized.text("No task selected") }
    static var noSelectionBody: String { Localized.text("Select a task to see its details.") }
    static var historyFailed: String { Localized.text("Couldn't load the history.") }
    static var historyOffline: String { Localized.text("History shows when todz is back online.") }

    static func byYou(time: String) -> String {
        Localized.text("\(time) by you")
    }

    static func viaClient(time: String, client: String) -> String {
        Localized.text("\(time) via \(client)")
    }
}
