import Foundation

enum WidgetCopy {
    static var nextUp: String { Localized.text("Next up") }
    static var dueToday: String { Localized.text("Due today") }
    static var allDone: String { Localized.text("All done for today") }
    static var noSnapshot: String { Localized.text("Open todz to see what's due today.") }
    static var ringName: String { Localized.text("Today's Progress") }
    static var ringDescription: String { Localized.text("How much of today is done.") }
    static var nextUpName: String { Localized.text("Next Up") }
    static var nextUpDescription: String { Localized.text("The next task due today, ready to check off.") }
    static var listDescription: String { Localized.text("Today's tasks, ready to check off.") }

    static func progress(done: Int, total: Int) -> AttributedString {
        Localized.attributed("**\(done) of \(total)** done")
    }
}
