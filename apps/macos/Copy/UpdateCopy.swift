enum UpdateCopy {
    static var checkForUpdates: String { Localized.text("Check for Updates…") }
    static var automaticUpdates: String { Localized.text("Update todz automatically") }
    static var automaticUpdatesDetail: String { Localized.text("Downloads new versions in the background and installs them when you quit or reopen todz.") }
    static var moveToApplications: String { Localized.text("Move todz to Applications so it can update itself") }
    static var moveToApplicationsDetail: String { Localized.text("Nothing moves unless you choose Move todz to Applications.") }
    static var moveToApplicationsConfirm: String { Localized.text("Move todz to Applications") }
    static var moveToApplicationsDecline: String { Localized.text("Not now") }
    static var quitTheOtherTodzFirst: String { Localized.text("Quit the other todz first. Nothing was moved.") }
    static var alreadyInApplications: String { Localized.text("todz is already in Applications.") }
    static var moveToApplicationsFailed: String { Localized.text("todz could not be moved to Applications. Nothing was changed, and it keeps running from here.") }
    static var moveToApplicationsRollbackFailed: String { Localized.text("todz could not be moved to Applications and could not remove its temporary copy there. Nothing else was changed.") }
    static var moveToApplicationsOpenFailed: String { Localized.text("todz was moved to Applications but could not open there. Open it from Applications.") }
    static func updatedTo(version: String) -> String {
        Localized.text("Updated to \(version)")
    }
}
