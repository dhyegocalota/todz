import TodzKit

enum AccessibilityCopy {
    static var rowValueOpen: String { Localized.text("Open") }
    static var rowValueDone: String { Localized.text("Done") }
    static var refreshing: String { Localized.text("Refreshing") }
    static var addTask: String { Localized.text("Add") }
    static var rowOpensWindow: String { Localized.text("Shows it in the todz window.") }
    static var disclosureCollapsed: String { Localized.text("Collapsed") }
    static var disclosureExpanded: String { Localized.text("Expanded") }
    static var markedDone: String { Localized.text("Done") }
    static var glanceOpensToday: String { Localized.text("Opens Today in the todz window.") }

    static func checkboxOpen(title: String) -> String {
        Localized.text("Mark \(title) as done")
    }

    static func checkboxDone(title: String) -> String {
        Localized.text("Mark \(title) as not done")
    }

    static func tomorrowLabel(title: String) -> String {
        Localized.text("Move \(title) to tomorrow")
    }

    static func noDateLabel(title: String) -> String {
        Localized.text("Remove the due date from \(title)")
    }

    static func dayCloseOpened(count: Int) -> String {
        Localized.text("Close the day, \(count) left")
    }

    static func announcement(of outcome: LingerOutcome) -> String {
        switch outcome {
        case .done: markedDone
        case .dueTomorrow, .noDueDate: MenuBarCopy.result(of: outcome)
        }
    }

    static func switcher(name: String) -> String {
        Localized.text("Workspace, \(name)")
    }

    static func openCount(count: Int) -> String {
        Localized.text("\(count) open")
    }

    static func menuBarCount(count: Int) -> String {
        Localized.text("todz, \(count) left today")
    }

    static func menuBarRibbon(_ content: RibbonContent) -> String {
        switch content {
        case let .remaining(left, next): Localized.text("\(menuBarCount(count: left)). Next: \(MenuBarCopy.ribbonTask(next))")
        case let .last(next): Localized.text("todz, last one today: \(MenuBarCopy.ribbonTask(next))")
        }
    }

    static func morningGlance(count: Int) -> String {
        Localized.text("Today, \(count) left")
    }

    static func todayIn(workspace: String) -> String {
        Localized.text("Today in \(workspace)")
    }
}
