import TodzKit

enum UsageSharingCopy {
    static var toggle: String { Localized.text("Share anonymous usage") }
    static var toggleDetail: String { Localized.text("Once a day, todz sends counts of features used, with a random code that changes every 30 days. Never tasks, names or addresses.") }
    static var askTitle: String { Localized.text("Share anonymous usage?") }
    static var askBody: String { Localized.text("Once a day, todz can send counts of the features you use, with a random code that changes every 30 days. Never tasks, names or addresses. You can change this in Settings.") }
    static var askShare: String { Localized.text("Share") }
    static var askDecline: String { Localized.text("Not Now") }

    static func title(of answer: UsageSharingAnswer) -> String {
        switch answer {
        case .share: askShare
        case .declineNow: askDecline
        }
    }
}
