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
    static let signOutFailed = "todz couldn't erase this Mac's copy of your tasks, so you're still signed in. Try again."

    static let serverAddressInvalid = "Enter an address like https://todz.example.com."
    static let serverSchemeMissing = "Start the address with https://."
    static let serverInsecureRemoteHost = "Use https://. Plain http:// works only for localhost."
    static let serverHostMissing = "Add the server's name after https://."
    static let serverAddressHasPath = "The address has no path. Enter the server's root address."
    static let serverAddressHasQuery = "Remove the part from ? on."
    static let serverAddressHasFragment = "Remove the part from # on."
    static let serverAddressHasCredentials = "Remove the name and password before @."
    static let notTodzServer = "No todz server answered at that address."

    static func serverNamedOther(origin: String) -> String {
        "That server answers as \(origin). Enter that address instead."
    }

    static func serverSwitchFailed(server: String) -> String {
        "This Mac's copy could not be erased, so todz stayed on \(server)."
    }

    static func serverSwitchBusy(server: String) -> String {
        "Sign-in was still in progress, so todz stayed on \(server)."
    }

    static func changesNotSaved(count: Int) -> String {
        InflectedCopy.text("^[\(count) change](inflect: true) weren't saved.")
    }
}
