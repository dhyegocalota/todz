enum SyncCopy {
    static var offline: String { Localized.text("Offline") }
    static var offlineHelp: String { Localized.text("Can't reach todz. Your changes are kept on this Mac and sent when it's back.") }
    static var signOutMessage: String { Localized.text("They haven't reached todz yet. Signing out erases them from this Mac.") }

    static func offlineWaiting(count: Int) -> String {
        Localized.text("Offline · \(count) changes waiting")
    }

    static func signOutTitle(count: Int) -> String {
        Localized.text("Sign out and lose \(count) changes?")
    }
}
