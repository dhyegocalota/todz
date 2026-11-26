enum UpdateCopy {
    static let checkForUpdates = "Check for Updates…"
    static let automaticUpdates = "Update todz automatically"
    static let automaticUpdatesDetail = "Downloads new versions in the background and installs them when you quit or reopen todz."
    static let moveToApplications = "Move todz to Applications so it can update itself"
    static let moveToApplicationsDetail = "Nothing moves unless you choose Move todz to Applications."
    static let moveToApplicationsConfirm = "Move todz to Applications"
    static let moveToApplicationsDecline = "Not now"
    static let quitTheOtherTodzFirst = "Quit the other todz first. Nothing was moved."
    static let alreadyInApplications = "todz is already in Applications."
    static let moveToApplicationsFailed = "todz could not be moved to Applications. Nothing was changed, and it keeps running from here."
    static let moveToApplicationsRollbackFailed = "todz could not be moved to Applications and could not remove its temporary copy there. Nothing else was changed."
    static let moveToApplicationsOpenFailed = "todz was moved to Applications but could not open there. Open it from Applications."
    static func updatedTo(version: String) -> String {
        "Updated to \(version)"
    }
}
