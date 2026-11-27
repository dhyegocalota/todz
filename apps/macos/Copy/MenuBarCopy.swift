import TodzKit

enum MenuBarCopy {
    static let openWindow = "Open todz"
    static let quit = "Quit todz"
    static let signedOut = "Sign in to see what's due today."
    static let naming = "Name your first workspace to see what's due today."
    static let choosing = "Choose a workspace to see what's due today."
    static let closeTheDay = "Close the day"
    static let done = "Done"
    static let noDate = "No date"
    static let dueTomorrow = "Due tomorrow"
    static let noDueDate = "No due date"
    static let dayClosedTitle = "Day closed"
    static let dayClosedBody = "Nothing left for today."
    static let doneHelp = "Mark as done (D)"
    static let tomorrowHelp = "Move to tomorrow (T)"
    static let noDateHelp = "Removes the due date. The task stays open. (N)"
    static let upNext = "Up next"
    static let allDoneTitle = "All done"
    static let more = "More"
    static let openWindowHelp = "Open todz (⌘O)"
    static let upNextHelp = "Mark the next task done (⌘↩)"
    static let updateAvailable = "Update available"
    static let newTaskKeycap = "⌘N"
    static let placeholderTitles = ["Send the homepage copy to Sam", "Renew the design tool licence", "Book the launch photo shoot"]

    static func progress(done: Int, total: Int) -> String {
        "\(done) of \(total) done"
    }

    static func todayProgress(left: Int, done: Int, total: Int) -> String {
        "Today, \(Self.left(count: left)), \(progress(done: done, total: total))"
    }

    static func left(count: Int) -> String {
        InflectedCopy.text("\(count) left")
    }

    static func doneToday(count: Int) -> String {
        InflectedCopy.text("\(count) done today")
    }

    static func ribbonRemaining(left: Int, next: String) -> String {
        "\(Self.left(count: left)) · next: \(next)"
    }

    static func ribbonLast(next: String) -> String {
        "Last one: \(next)"
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
