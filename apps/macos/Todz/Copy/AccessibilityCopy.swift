enum AccessibilityCopy {
    static let rowValueOpen = "Open"
    static let rowValueDone = "Done"
    static let refreshing = "Refreshing"
    static let addProject = "New Project"
    static let rowOpensWindow = "Shows it in the todz window."

    static func checkboxOpen(title: String) -> String {
        "Mark \(title) as done"
    }

    static func checkboxDone(title: String) -> String {
        "Mark \(title) as not done"
    }

    static func switcher(name: String) -> String {
        "Workspace, \(name)"
    }

    static func openCount(count: Int) -> String {
        "\(count) open"
    }
}
