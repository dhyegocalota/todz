import TodzKit

enum SettingsCopy {
    static let showPendingCount = "Show pending count in the menu bar"
    static let showPendingCountDetail = "Today's open tasks in the active workspace. Hidden when none are left."
    static let agentNudge = "Let agents mention today's tasks"
    static let agentNudgeDetail = "When an agent asks what's next, it hears what's due today in its project."
    static let agentNudgeOffline = "Can't reach todz. You can change this when it's back."
    static let agentNudgeSignedOut = "Sign in to change this."

    static func agentNudgeSubtitle(notice: AgentNudgeNotice) -> String {
        switch notice {
        case .detail: agentNudgeDetail
        case .signedOut: agentNudgeSignedOut
        case .offline: agentNudgeOffline
        case .notSaved: ErrorCopy.changeNotSaved
        }
    }
}
