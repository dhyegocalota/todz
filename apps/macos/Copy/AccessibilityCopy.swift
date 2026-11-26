import TodzKit

enum AccessibilityCopy {
    static let rowValueOpen = "Open"
    static let rowValueDone = "Done"
    static let refreshing = "Refreshing"
    static let addProject = "New Project"
    static let addTask = "Add"
    static let rowOpensWindow = "Shows it in the todz window."
    static let disclosureCollapsed = "Collapsed"
    static let disclosureExpanded = "Expanded"
    static let markedDone = "Done"
    static let glanceOpensToday = "Opens Today in the todz window."

    static func checkboxOpen(title: String) -> String {
        "Mark \(title) as done"
    }

    static func checkboxDone(title: String) -> String {
        "Mark \(title) as not done"
    }

    static func tomorrowLabel(title: String) -> String {
        "Move \(title) to tomorrow"
    }

    static func noDateLabel(title: String) -> String {
        "Remove the due date from \(title)"
    }

    static func dayCloseOpened(count: Int) -> String {
        InflectedCopy.text("Close the day, \(count) left")
    }

    static func announcement(of outcome: LingerOutcome) -> String {
        switch outcome {
        case .done: markedDone
        case .dueTomorrow, .noDueDate: MenuBarCopy.result(of: outcome)
        }
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

    static func menuBarRibbon(_ content: RibbonContent) -> String {
        switch content {
        case let .remaining(left, next): "\(menuBarCount(count: left)). Next: \(MenuBarCopy.ribbonTask(next))"
        case let .last(next): "todz, last one today: \(MenuBarCopy.ribbonTask(next))"
        }
    }

    static func morningGlance(count: Int) -> String {
        InflectedCopy.text("Today, \(count) left")
    }

    static func todayIn(workspace: String) -> String {
        "Today in \(workspace)"
    }
}
