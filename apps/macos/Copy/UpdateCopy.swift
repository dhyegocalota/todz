enum UpdateCopy {
    static let checkForUpdates = "Check for Updates…"
    static let automaticUpdates = "Update todz automatically"
    static let automaticUpdatesDetail = "Downloads new versions in the background and installs them when you quit or reopen todz."
    static let moveToApplications = "Move todz to Applications so it can update itself"
    static let moveToApplicationsConfirm = "Move to Applications"
    static let moveToApplicationsDecline = "Not now"
    static let quitTheOtherTodzFirst = "Quit the other todz first"
    static let moveToApplicationsFailed = "todz could not be copied to Applications. It keeps running from here."
    static func updatedTo(version: String) -> String {
        "Updated to \(version)"
    }
}
