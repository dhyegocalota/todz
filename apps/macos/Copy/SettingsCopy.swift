import TodzKit

enum SettingsCopy {
    static let showPendingCount = "Show pending count in the menu bar"
    static let showPendingCountDetail = "Today's open tasks in the active workspace. Hidden when none are left."
    static let agentNudge = "Let agents mention today's tasks"
    static let agentNudgeDetail = "When an agent asks what's next, it hears what's due today in its project."
    static let agentNudgeOffline = "Can't reach todz. You can change this when it's back."
    static let agentNudgeSignedOut = "Sign in to change this."
    static let focusQuiet = "Quiet during Focus"
    static let focusQuietDetail = "todz stays quiet in any Focus with the todz filter on."
    static let focusQuietNow = "Quiet now, until this Focus ends."
    static let openFocusSettings = "Open Focus Settings"
    static let closeTheDay = "Close the day"
    static let closeTheDayDetail = "At this time each day, todz opens on what's left of Today."
    static let closeTheDayTime = "Time to close the day"

    static func agentNudgeSubtitle(notice: AgentNudgeNotice) -> String {
        switch notice {
        case .detail: agentNudgeDetail
        case .signedOut: agentNudgeSignedOut
        case .offline: agentNudgeOffline
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
