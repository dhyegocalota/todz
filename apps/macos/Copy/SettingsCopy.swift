import TodzKit

enum SettingsCopy {
    static let showPendingCount = "Show pending count in the menu bar"
    static let showPendingCountDetail = "Today's open tasks in the active workspace. Hidden when none are left."
    static let keepInMenuBar = "Keep todz in the menu bar when closed"
    static let keepInMenuBarDetail = "With no window open, todz leaves the Dock and ⌘Tab. The menu bar, widgets and Siri keep working."
    static let agentNudge = "Let agents mention today's tasks"
    static let agentNudgeDetail = "When an agent asks what's next, it hears what's due today in its project."
    static let ownerSettingOffline = "Can't reach todz. You can change this when it's back."
    static let ownerSettingSignedOut = "Sign in to change this."
    static let respectFocus = "Respect Focus"
    static let respectFocusDetail = "Hold what todz shows on this Mac in a Focus that has the todz filter."
    static let respectFocusHelper = "Add the todz filter to a Focus."
    static let general = "General"
    static let proactive = "Proactive"
    static let privacyAndUpdates = "Privacy & updates"
    static let workspaces = "Workspaces"
    static let workspaceActions = "Workspace actions"
    static let focusQuietNow = "Quiet now, until this Focus ends."
    static let openFocusSettings = "Open Focus Settings"
    static let closeTheDay = "Close the day"
    static let closeTheDayDetail = "At this time each day, todz opens on what's left of Today."
    static let closeTheDayTime = "Time to close the day"
    static let morningGlance = "Morning glance"
    static let morningGlanceDetail = "On the first wake or unlock of each day, todz shows Today for a few seconds."
    static let dayTemperature = "Day temperature"
    static let dayTemperatureDetail = "Dims the menu bar count through the afternoon and tints overdue widget rows."
    static let dayEmail = "Email me my day"
    static let dayEmailDetail = "At this time each day, todz mails Today to your sign-in address. Reply to add a task."
    static let dayEmailTime = "Time to email my day"
    static let menuBarRibbon = "Menu bar ribbon"
    static let menuBarRibbonDetail = "Now and then, shows what's next beside the menu bar icon for a few seconds."
    static let menuBarRibbonCadence = "When the ribbon shows"
    static let menuBarRibbonHourly = "Every hour"
    static let menuBarRibbonDayClose = "At the close of the day"
    static let menuBarRibbonAgentChange = "When an agent adds or completes a task"
    static let menuBarRibbonDayCloseOverlap = "Close the day already opens todz at that time."
    static let lockWorkspaces = "Lock other workspaces"
    static let lockWorkspacesDetailOff = "Ask for Touch ID or your Mac password before opening any workspace but this one."
    static let lockWorkspacesDetailOn = "Other workspaces show as locked until you unlock them with Touch ID or your Mac password."
    static let lockTimeout = "Lock again after"
    static let lockTimeoutDetail = "Locks sooner when the Mac sleeps or the screen locks."
    static let lockTimeoutOneMinute = "1 minute"
    static let lockTimeoutFiveMinutes = "5 minutes"
    static let lockTimeoutFifteenMinutes = "15 minutes"
    static let lockTimeoutOneHour = "1 hour"
    static let lockUnavailable = "Set a password for this Mac to use this lock."
    static let ownerKeys = "Account keys"
    static let ownerKeysDetail = "An account key lets an AI agent create, rename and delete your workspaces and projects and change these settings. It cannot read your tasks. It is off until you create one. Keep it out of any repository."
    static let noOwnerKeys = "No account keys. Agents can still use your project keys."
    static let createOwnerKey = "Create an account key"
    static let ownerKeysAtLimit = "You have five account keys. Revoke one to create another."
    static let ownerKeyCreatedTitle = "Your account key"
    static let ownerKeyCreatedBody = "Copy it now: it is shown once, and anyone who holds it can delete your workspaces. Revoke it here if it leaks."
    static let ownerKeyCommandCaption = "Run it in your project's folder to give Claude Code the key."
    static let ownerKeyCommand = "Claude Code command"
    static let copyOwnerKey = "Copy key"
    static let ownerKeyDone = "Done"
    static let revokeOwnerKey = "Revoke"
    static let revokeOwnerKeyTitle = "Revoke this key?"
    static let revokeOwnerKeyMessage = "Agents that use it lose access at once."
    static let ownerKeyNotCreated = "The key wasn't created."
    static let connectedApps = "Connected apps"
    static let connectedAppsDetail = "Apps you approved in the browser to use todz over MCP. Disconnecting one signs it out right away."
    static let noConnectedApps = "No connected apps yet. Add todz to Claude Code, Claude.ai or Codex with its address and approve it in the browser."
    static let connectedAppAccountScope = "Your whole account"
    static let disconnectConnectedApp = "Disconnect"
    static let disconnectConnectedAppMessage = "It loses access at once. You can connect it again from the app."
    static let connectedAppNotDisconnected = "The app wasn't disconnected. It still has access."
    static let server = "Server"
    static let serverDetail = "Where your tasks are kept. Switching signs you out and erases this Mac's copy."
    static let serverAddressLabel = "Server address"
    static let serverPlaceholder = "https://todz.example.com"
    static let switchServer = "Switch…"
    static let useTodzCloud = "Use todz cloud"
    static let checkingServer = "Checking…"
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

    static func lockTimeoutName(_ timeout: WorkspaceLockTimeout) -> String {
        switch timeout {
        case .oneMinute: lockTimeoutOneMinute
        case .fiveMinutes: lockTimeoutFiveMinutes
        case .fifteenMinutes: lockTimeoutFifteenMinutes
        case .oneHour: lockTimeoutOneHour
        }
    }

    static func cadenceName(_ cadence: RibbonCadence) -> String {
        switch cadence {
        case .hourly: menuBarRibbonHourly
        case .dayClose: menuBarRibbonDayClose
        case .agentChange: menuBarRibbonAgentChange
        }
    }

    static func ownerKeyEnding(hint: String) -> String {
        "Account key ending in \(hint)"
    }

    static func ownerKeyMasked(hint: String) -> String {
        "todz-owner_…\(hint)"
    }

    static func ownerKeyFailure(_ failure: OwnerKeyFailure) -> String {
        switch failure {
        case .limitReached: ownerKeysAtLimit
        case .notCreated: ownerKeyNotCreated
        case .notRevoked: KeyScreenCopy.revokeFailed
        case let .refused(message): message
        }
    }

    static func disconnectConnectedAppTitle(clientName: String) -> String {
        "Disconnect \(clientName)?"
    }

    static func connectedAppScope(_ scope: ConnectedAppScope) -> String {
        switch scope {
        case let .project(_, name): "Project: \(name)"
        case .owner: connectedAppAccountScope
        }
    }

    static func connectedAppSummary(scope: String, redirectHost: String, lastUsed: String) -> String {
        "\(scope) · \(redirectHost) · Last used \(lastUsed)"
    }

    static func connectedAppFailure(_ failure: ConnectedAppFailure) -> String {
        switch failure {
        case .notDisconnected: connectedAppNotDisconnected
        }
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
        case .notQuiet: respectFocusDetail
        case .quietNow: focusQuietNow
        }
    }
}
