enum TaskRowCopy {
    static var dueToday: String { Localized.text("Today") }
    static var dueTomorrow: String { Localized.text("Tomorrow") }
    static var pending: String { Localized.text("Not saved yet") }
    static var pendingHelp: String { Localized.text("Not saved yet. It gets its number once todz has it.") }

    static func overdue(date: String) -> String {
        Localized.text("Overdue · \(date)")
    }

    static func via(client: String) -> String {
        Localized.text("via \(client)")
    }

    static func completedVia(client: String) -> String {
        Localized.text("completed via \(client)")
    }

    static func shortId(number: Int) -> String {
        "T-\(number)"
    }
}
