import TodzKit

enum SettingsCopy {
    static let showPendingCount = "Show pending count in the menu bar"
    static let showPendingCountDetail = "Today's open tasks in the active workspace. Hidden when none are left."
    static let agentNudge = "Let agents mention today's tasks"
    static let agentNudgeDetail = "When an agent asks what's next, it hears what's due today in its project."
    static let ownerSettingOffline = "Can't reach todz. You can change this when it's back."
    static let ownerSettingSignedOut = "Sign in to change this."
    static let focusQuiet = "Quiet during Focus"
    static let focusQuietDetail = "todz stays quiet in any Focus with the todz filter on."
    static let focusQuietNow = "Quiet now, until this Focus ends."
    static let openFocusSettings = "Open Focus Settings"
    static let closeTheDay = "Close the day"
    static let closeTheDayDetail = "At this time each day, todz opens on what's left of Today."
    static let closeTheDayTime = "Time to close the day"
    static let morningGlance = "Morning glance"
    static let morningGlanceDetail = "On the first wake or unlock of each day, todz shows Today for a few seconds."
    static let dayEmail = "Email me my day"
    static let dayEmailDetail = "At this time each day, todz mails Today to your sign-in address. Reply to add a task."
    static let dayEmailTime = "Time to email my day"
    static let server = "Server"
    static let serverDetail = "Where your tasks are kept. Switching signs you out and erases this Mac's copy."
    static let serverAddressLabel = "Server address"
    static let serverPlaceholder = "https://todz.example.com"
    static let switchServer = "Switch…"
    static let useTodzCloud = "Use todz cloud"
    static let checkingServer = "Checking the server…"
    static let switchingServer = "Switching…"
    static let serverEmpty = "Enter a server address."
    static let serverInUse = "todz already uses this server."
    static let serverBusy = "Wait until sign-in or the switch finishes."
    static let confirmSwitch = "Switch Server"

    static func switchTitle(server: String) -> String {
        "Switch to \(server)?"
    }

    static func switchMessage(server: String) -> String {
        "You'll be signed out, and this Mac's copy of your tasks is erased. Your tasks stay on \(server)."
    }

    static func switchLosingTitle(server: String, count: Int) -> String {
        InflectedCopy.text("Switch to \(server) and lose ^[\(count) change](inflect: true)?")
    }

    static func switchLosingSignedInMessage(server: String) -> String {
        "They haven't reached \(server) yet. Switching signs you out and erases them from this Mac."
    }

    static func switchLosingSignedOutMessage(server: String) -> String {
        "They haven't reached \(server) yet. Switching erases them from this Mac."
    }

    static func switched(server: String) -> String {
        "Switched to \(server). Sign in from the todz window."
    }

    static func confirmationTitle(server: String, losing: Int) -> String {
        guard losing > 0 else { return switchTitle(server: server) }
        return switchLosingTitle(server: server, count: losing)
    }

    static func confirmationMessage(server: String, losing: Int, signedIn: Bool) -> String {
        guard losing > 0 else { return switchMessage(server: server) }
        return signedIn ? switchLosingSignedInMessage(server: server) : switchLosingSignedOutMessage(server: server)
    }

    static func ownerSettingSubtitle(notice: OwnerSettingNotice, detail: String) -> String {
        switch notice {
        case .detail: detail
        case .signedOut: ownerSettingSignedOut
        case .offline: ownerSettingOffline
        case .notSaved: ErrorCopy.changeNotSaved
        }
    }

    static func focusQuietSubtitle(notice: FocusQuietNotice) -> String {
        switch notice {
        case .notQuiet: focusQuietDetail
        case .quietNow: focusQuietNow
        }
    }
}
