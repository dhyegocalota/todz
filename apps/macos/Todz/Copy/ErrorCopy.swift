import TodzKit

enum ErrorCopy {
    static let networkTitle = "Can't reach todz"
    static let networkBody = "Check your connection, then try again."
    static let serverTitle = "Something went wrong"
    static let serverBody = "todz couldn't finish that. Try again."
    static let someProjectsFailed = "Some projects didn't load."
    static let changeNotSaved = "Your change wasn't saved."
    static let sessionNotSaved = "You're signed in, but todz couldn't save your session for next time."
    static let titleEmpty = "A task needs a title."
    static let titleTooLong = "Titles can be up to \(TaskLimits.titleMaxLength.formatted()) characters."
    static let notesTooLong = "Notes can be up to \(TaskLimits.notesMaxLength.formatted()) characters."
    static let nameEmpty = "Add a name."
    static let nameTooLong = "Names can be up to \(TaskLimits.nameMaxLength.formatted()) characters."
    static let dueDateInvalid = "That date isn't valid."
    static let inboxIsFixed = "The Inbox can't be renamed."
    static let taskGone = "This task is no longer available."
    static let projectGone = "This project is no longer available."
    static let workspaceGone = "This workspace is no longer available."
    static let ruleUnexpected = "todz couldn't save this change."
    static let changeNotSavedBody = "todz now shows what it has saved."
    static let cacheNotSaved = "Changes can't be kept on this Mac. They're sent while todz is open."
    static let waitingChangesLost = "Changes waiting on this Mac couldn't be read and were lost."

    static func changesNotSaved(count: Int) -> String {
        "\(count.formatted()) changes weren't saved."
    }
}
