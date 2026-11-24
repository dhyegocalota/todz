import Foundation

enum WidgetCopy {
    static let nextUp = "Next up"
    static let dueToday = "Due today"
    static let allDone = "All done for today"
    static let noSnapshot = "Open todz to see what's due today."
    static let ringName = "Today's Progress"
    static let ringDescription = "How much of today is done."
    static let nextUpName = "Next Up"
    static let nextUpDescription = "The next task due today, ready to check off."
    static let listDescription = "Today's tasks, ready to check off."

    static func progress(done: Int, total: Int) -> AttributedString {
        AttributedString(localized: "**\(done) of \(total)** done")
    }
}
