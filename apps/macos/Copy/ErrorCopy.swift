import TodzKit

enum ErrorCopy {
    static var networkTitle: String { Localized.text("Can't reach todz") }
    static var networkBody: String { Localized.text("Check your connection, then try again.") }
    static var serverTitle: String { Localized.text("Something went wrong") }
    static var serverBody: String { Localized.text("todz couldn't finish that. Try again.") }
    static var someProjectsFailed: String { Localized.text("Some projects didn't load.") }
    static var changeNotSaved: String { Localized.text("Your change wasn't saved.") }
    static var sessionNotSaved: String { Localized.text("You're signed in, but todz couldn't save your session for next time.") }
    static var titleEmpty: String { Localized.text("A task needs a title.") }
    static var titleTooLong: String { Localized.text("Titles can be up to \(TaskLimits.titleMaxLength.formatted(.number.locale(Localized.locale))) characters.") }
    static var notesTooLong: String { Localized.text("Notes can be up to \(TaskLimits.notesMaxLength.formatted(.number.locale(Localized.locale))) characters.") }
    static var nameEmpty: String { Localized.text("Add a name.") }
    static var nameTooLong: String { Localized.text("Names can be up to \(TaskLimits.nameMaxLength.formatted(.number.locale(Localized.locale))) characters.") }
    static var dueDateInvalid: String { Localized.text("That date isn't valid.") }
    static var inboxIsFixed: String { Localized.text("The Inbox can't be renamed or deleted.") }
    static var taskGone: String { Localized.text("This task is no longer available.") }
    static var taskChangedBeforeDelete: String { Localized.text("This task changed before it could be deleted, so it was kept. Check it, then delete it again.") }
    static var projectGone: String { Localized.text("This project is no longer available.") }
    static var workspaceGone: String { Localized.text("This workspace is no longer available.") }
    static var ruleUnexpected: String { Localized.text("todz couldn't save this change.") }
    static var changeNotSavedBody: String { Localized.text("todz now shows what it has saved.") }
    static var cacheNotSaved: String { Localized.text("Changes can't be kept on this Mac. They're sent while todz is open.") }
    static var waitingChangesLost: String { Localized.text("Changes waiting on this Mac couldn't be read and were lost.") }
    static var updateNeededTitle: String { Localized.text("Update todz to keep syncing") }
    static var updateNeededBody: String { Localized.text("Your changes wait here until then.") }
    static var alreadySignedIn: String { Localized.text("You're already signed in.") }
    static var fairUsePausedBody: String { Localized.text("Your changes wait here and are sent when the limit lifts.") }
    static var signOutFailed: String { Localized.text("todz couldn't erase this Mac's copy of your tasks, so you're still signed in. Try again.") }

    static var serverAddressInvalid: String { Localized.text("Enter an address like https://todz.example.com.") }
    static var serverSchemeMissing: String { Localized.text("Start the address with https://.") }
    static var serverInsecureRemoteHost: String { Localized.text("Use https://. Plain http:// works only for localhost.") }
    static var serverHostMissing: String { Localized.text("Add the server's name after https://.") }
    static var serverAddressHasPath: String { Localized.text("Leave out the path. Enter the server's root address.") }
    static var serverAddressHasQuery: String { Localized.text("Remove the part from ? on.") }
    static var serverAddressHasFragment: String { Localized.text("Remove the part from # on.") }
    static var serverAddressHasCredentials: String { Localized.text("Remove the name and password before @.") }
    static var notTodzServer: String { Localized.text("No todz server answered at that address.") }

    static func serverNamedOther(origin: String) -> String {
        Localized.text("That server answers as \(origin). Enter that address instead.")
    }

    static func serverSwitchFailed(server: String) -> String {
        Localized.text("This Mac's copy could not be erased, so todz stayed on \(server).")
    }

    static func serverSwitchBusy(server: String) -> String {
        Localized.text("Sign-in was still in progress, so todz stayed on \(server).")
    }

    static func changesNotSaved(count: Int) -> String {
        Localized.text("\(count) changes weren't saved.")
    }
}
