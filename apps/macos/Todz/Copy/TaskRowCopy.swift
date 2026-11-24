enum TaskRowCopy {
    static let dueToday = "Today"
    static let dueTomorrow = "Tomorrow"

    static func overdue(date: String) -> String {
        "Overdue · \(date)"
    }

    static func via(client: String) -> String {
        "via \(client)"
    }

    static func completedVia(client: String) -> String {
        "completed via \(client)"
    }

    static func shortId(number: Int) -> String {
        "T-\(number)"
    }
}
