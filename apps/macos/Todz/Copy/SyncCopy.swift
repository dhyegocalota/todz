enum SyncCopy {
    static let offline = "Offline"
    static let offlineHelp = "Can't reach todz. Your changes are kept on this Mac and sent when it's back."
    static let signOutMessage = "They haven't reached todz yet. Signing out erases them from this Mac."

    static func offlineWaiting(count: Int) -> String {
        InflectedCopy.text("Offline · ^[\(count) change](inflect: true) waiting")
    }

    static func signOutTitle(count: Int) -> String {
        InflectedCopy.text("Sign out and lose ^[\(count) change](inflect: true)?")
    }
}
