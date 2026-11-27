import TodzKit

enum SettingsCopy {
    static var showPendingCount: String { Localized.text("Show pending count in the menu bar") }
    static var showPendingCountDetail: String { Localized.text("Today's open tasks in the active workspace. Hidden when none are left.") }
    static var keepInMenuBar: String { Localized.text("Keep todz in the menu bar when closed") }
    static var keepInMenuBarDetail: String { Localized.text("With no window open, todz leaves the Dock and ⌘Tab. The menu bar, widgets and Siri keep working.") }
    static var agentNudge: String { Localized.text("Let agents mention today's tasks") }
    static var agentNudgeDetail: String { Localized.text("When an agent asks what's next, it hears what's due today in its project.") }
    static var ownerSettingOffline: String { Localized.text("Can't reach todz. You can change this when it's back.") }
    static var ownerSettingSignedOut: String { Localized.text("Sign in to change this.") }
    static var respectFocus: String { Localized.text("Respect Focus") }
    static var respectFocusDetail: String { Localized.text("Hold what todz shows on this Mac in a Focus that has the todz filter.") }
    static var respectFocusHelper: String { Localized.text("Add the todz filter to a Focus.") }
    static var language: String { Localized.text("Language") }
    static var languageDetail: String { Localized.text("Choose the language of todz on this Mac. System follows your Mac.") }
    static var languageSystem: String { Localized.text("System") }
    static var appearance: String { Localized.text("Appearance") }
    static var appearanceDetail: String { Localized.text("Light, dark or the Mac's setting. Widgets follow the desktop.") }
    static var appearanceLight: String { Localized.text("Light") }
    static var appearanceDark: String { Localized.text("Dark") }
    static var general: String { Localized.text("General") }
    static var proactive: String { Localized.text("Proactive") }
    static var privacyAndUpdates: String { Localized.text("Privacy & updates") }
    static var workspaces: String { Localized.text("Workspaces") }
    static var workspaceActions: String { Localized.text("Workspace actions") }
    static var focusQuietNow: String { Localized.text("Quiet now, until this Focus ends.") }
    static var openFocusSettings: String { Localized.text("Open Focus Settings") }
    static var closeTheDay: String { Localized.text("Close the day") }
    static var closeTheDayDetail: String { Localized.text("At this time each day, todz opens on what's left of Today.") }
    static var closeTheDayTime: String { Localized.text("Time to close the day") }
    static var morningGlance: String { Localized.text("Morning glance") }
    static var morningGlanceDetail: String { Localized.text("On the first wake or unlock of each day, todz shows Today for a few seconds.") }
    static var dayTemperature: String { Localized.text("Day temperature") }
    static var dayTemperatureDetail: String { Localized.text("Dims the menu bar count through the afternoon and tints overdue widget rows.") }
    static var dayEmail: String { Localized.text("Email me my day") }
    static var dayEmailDetail: String { Localized.text("At this time each day, todz mails Today to your sign-in address. Reply to add a task.") }
    static var dayEmailTime: String { Localized.text("Time to email my day") }
    static var menuBarRibbon: String { Localized.text("Menu bar ribbon") }
    static var menuBarRibbonDetail: String { Localized.text("Now and then, shows what's next beside the menu bar icon for a few seconds.") }
    static var menuBarRibbonCadence: String { Localized.text("When the ribbon shows") }
    static var menuBarRibbonHourly: String { Localized.text("Every hour") }
    static var menuBarRibbonDayClose: String { Localized.text("At the close of the day") }
    static var menuBarRibbonAgentChange: String { Localized.text("When an agent adds or completes a task") }
    static var menuBarRibbonDayCloseOverlap: String { Localized.text("Close the day already opens todz at that time.") }
    static var lockWorkspaces: String { Localized.text("Require Touch ID to switch workspaces") }
    static var lockWorkspacesDetail: String { Localized.text("Ask for Touch ID or your Mac password before switching workspaces.") }
    static var lockTimeout: String { Localized.text("Ask again after") }
    static var lockTimeoutDetail: String { Localized.text("Also asks again when the Mac sleeps or the screen locks.") }
    static var lockTimeoutOneMinute: String { Localized.text("1 minute") }
    static var lockTimeoutFiveMinutes: String { Localized.text("5 minutes") }
    static var lockTimeoutFifteenMinutes: String { Localized.text("15 minutes") }
    static var lockTimeoutOneHour: String { Localized.text("1 hour") }
    static var lockUnavailable: String { Localized.text("Set a password for this Mac to turn this on.") }
    static var connectedApps: String { Localized.text("Connected apps") }
    static var connectedAppsDetail: String { Localized.text("Apps you approved in the browser to use todz over MCP. Disconnecting one signs it out right away.") }
    static var noConnectedApps: String { Localized.text("No connected apps yet. Add todz to Claude Code, Claude.ai or Codex with its address and approve it in the browser.") }
    static var connectedAppAccountScope: String { Localized.text("Your whole account") }
    static var removeScope: String { Localized.text("Remove") }
    static var limitConnectedApp: String { Localized.text("Limit to…") }
    static var connectedAppNotNarrowed: String { Localized.text("The app wasn't limited. It still has the access it had.") }
    static var disconnectConnectedApp: String { Localized.text("Disconnect") }
    static var disconnectConnectedAppMessage: String { Localized.text("It loses access at once. You can connect it again from the app.") }
    static var connectedAppNotDisconnected: String { Localized.text("The app wasn't disconnected. It still has access.") }
    static var server: String { Localized.text("Server") }
    static var serverDetail: String { Localized.text("Where your tasks are kept. Switching signs you out and erases this Mac's copy.") }
    static var serverAddressLabel: String { Localized.text("Server address") }
    static let serverPlaceholder = "https://todz.example.com"
    static var switchServer: String { Localized.text("Switch…") }
    static var useTodzCloud: String { Localized.text("Use todz cloud") }
    static var checkingServer: String { Localized.text("Checking…") }
    static var switchingServer: String { Localized.text("Switching…") }
    static var serverEmpty: String { Localized.text("Enter a server address.") }
    static var serverInUse: String { Localized.text("todz already uses this server.") }
    static var serverBusy: String { Localized.text("Wait until sign-in or the switch finishes.") }
    static var confirmSwitch: String { Localized.text("Switch Server") }

    static func switchTitle(server: String) -> String {
        Localized.text("Switch to \(server)?")
    }

    static func switchMessage(server: String) -> String {
        Localized.text("You'll be signed out, and this Mac's copy of your tasks is erased. Your tasks stay on \(server).")
    }

    static func switchLosingTitle(server: String, count: Int) -> String {
        Localized.text("Switch to \(server) and lose \(count) changes?")
    }

    static func switchLosingSignedInMessage(server: String) -> String {
        Localized.text("They haven't reached \(server) yet. Switching signs you out and erases them from this Mac.")
    }

    static func switchLosingSignedOutMessage(server: String) -> String {
        Localized.text("They haven't reached \(server) yet. Switching erases them from this Mac.")
    }

    static func switched(server: String) -> String {
        Localized.text("Switched to \(server). Sign in from the todz window.")
    }

    static func confirmationTitle(server: String, losing: Int) -> String {
        guard losing > 0 else { return switchTitle(server: server) }
        return switchLosingTitle(server: server, count: losing)
    }

    static func confirmationMessage(server: String, losing: Int, signedIn: Bool) -> String {
        guard losing > 0 else { return switchMessage(server: server) }
        return signedIn ? switchLosingSignedInMessage(server: server) : switchLosingSignedOutMessage(server: server)
    }

    static func languageName(_ choice: LanguageChoice) -> String {
        switch choice {
        case .system: languageSystem
        case let .language(language): language.nativeName
        }
    }

    static func appearanceName(_ choice: AppearanceChoice) -> String {
        switch choice {
        case .system: languageSystem
        case .light: appearanceLight
        case .dark: appearanceDark
        }
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

    static func disconnectConnectedAppTitle(clientName: String) -> String {
        Localized.text("Disconnect \(clientName)?")
    }

    static func connectedAppScope(_ scope: ConnectedScope) -> String {
        switch scope {
        case .account: connectedAppAccountScope
        case let .workspace(_, name): Localized.text("Every project in \(name)")
        case let .project(_, name, _, workspaceName): Localized.text("\(name) in \(workspaceName)")
        }
    }

    static func connectedAppSummary(redirectHost: String, lastUsed: String) -> String {
        Localized.text("\(redirectHost) · Last used \(lastUsed)")
    }

    static func removeScopeLabel(scope: String, clientName: String) -> String {
        Localized.text("Remove \(scope) from \(clientName)")
    }

    static func limitLabel(clientName: String) -> String {
        Localized.text("Limit \(clientName) to…")
    }

    static func connectedAppFailure(_ failure: ConnectedAppFailure) -> String {
        switch failure {
        case .notDisconnected: connectedAppNotDisconnected
        case .notNarrowed: connectedAppNotNarrowed
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
