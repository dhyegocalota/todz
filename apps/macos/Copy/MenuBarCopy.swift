import TodzKit

enum MenuBarCopy {
    static var openWindow: String { Localized.text("Open todz") }
    static var quit: String { Localized.text("Quit todz") }
    static var signedOut: String { Localized.text("Sign in to see what's due today.") }
    static var naming: String { Localized.text("Name your first workspace to see what's due today.") }
    static var choosing: String { Localized.text("Choose a workspace to see what's due today.") }
    static var closeTheDay: String { Localized.text("Close the day") }
    static var done: String { Localized.text("Done") }
    static var noDate: String { Localized.text("No date") }
    static var dueTomorrow: String { Localized.text("Due tomorrow") }
    static var noDueDate: String { Localized.text("No due date") }
    static var dayClosedTitle: String { Localized.text("Day closed") }
    static var dayClosedBody: String { Localized.text("Nothing left for today.") }
    static var doneHelp: String { Localized.text("Mark as done (D)") }
    static var tomorrowHelp: String { Localized.text("Move to tomorrow (T)") }
    static var noDateHelp: String { Localized.text("Removes the due date. The task stays open. (N)") }
    static var upNext: String { Localized.text("Up next") }
    static var allDoneTitle: String { Localized.text("All done") }
    static var more: String { Localized.text("More") }
    static var openWindowHelp: String { Localized.text("Open todz (⌘O)") }
    static var upNextHelp: String { Localized.text("Mark the next task done (⌘↩)") }
    static var updateAvailable: String { Localized.text("Update available") }
    static let newTaskKeycap = "⌘N"
    static var hiddenItemTitle: String { Localized.text("macOS is keeping todz off the menu bar") }
    static var hiddenItemDetail: String { Localized.text("Turn on todz under Allow in the Menu Bar, in System Settings › Menu Bar, to see today's count and open the popover.") }
    static var hiddenItemOpenSettings: String { Localized.text("Open Menu Bar Settings") }
    static var hiddenItemNotNow: String { Localized.text("Not Now") }
    static var hiddenItemSuppression: String { Localized.text("Don't show this again") }
    static var placeholderTitles: [String] {
        [
            Localized.text("Send the homepage copy to Sam"),
            Localized.text("Renew the design tool licence"),
            Localized.text("Book the launch photo shoot"),
        ]
    }

    static func progress(done: Int, total: Int) -> String {
        Localized.text("\(done) of \(total) done")
    }

    static func todayProgress(left: Int, done: Int, total: Int) -> String {
        Localized.text("Today, \(left) left, \(done) of \(total) done")
    }

    static func left(count: Int) -> String {
        Localized.text("\(count) left")
    }

    static func doneToday(count: Int) -> String {
        Localized.text("\(count) done today")
    }

    static func ribbonRemaining(left: Int, next: String) -> String {
        Localized.text("\(left) left · next: \(next)")
    }

    static func ribbonLast(next: String) -> String {
        Localized.text("Last one: \(next)")
    }

    static func ribbonTask(_ task: RibbonTask) -> String {
        guard let number = task.number else { return task.title }
        return "\(TaskRowCopy.shortId(number: number)) \(task.title)"
    }

    static func ribbon(_ content: RibbonContent) -> String {
        switch content {
        case let .remaining(left, next): ribbonRemaining(left: left, next: ribbonTask(next))
        case let .last(next): ribbonLast(next: ribbonTask(next))
        }
    }

    static func result(of outcome: LingerOutcome) -> String {
        switch outcome {
        case .done: done
        case .dueTomorrow: dueTomorrow
        case .noDueDate: noDueDate
        }
    }
}
