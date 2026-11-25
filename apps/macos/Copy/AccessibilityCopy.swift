enum AccessibilityCopy {
    static let rowValueOpen = "Open"
    static let rowValueDone = "Done"
    static let refreshing = "Refreshing"
    static let addProject = "New Project"
    static let rowOpensWindow = "Shows it in the todz window."
    static let disclosureCollapsed = "Collapsed"
    static let disclosureExpanded = "Expanded"

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

    static func menuBarCount(count: Int) -> String {
        InflectedCopy.text("todz, \(count) left today")
    }

    static func todayIn(workspace: String) -> String {
        "Today in \(workspace)"
    }
}
