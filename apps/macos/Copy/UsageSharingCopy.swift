import TodzKit

enum UsageSharingCopy {
    static let toggle = "Share anonymous usage"
    static let toggleDetail = "Once a day, todz sends counts of features used, with a random code that changes every 30 days. Never tasks, names or addresses."
    static let askTitle = "Share anonymous usage?"
    static let askBody = "Once a day, todz can send counts of the features you use, with a random code that changes every 30 days. Never tasks, names or addresses. You can change this in Settings."
    static let askShare = "Share"
    static let askDecline = "Not Now"

    static func title(of answer: UsageSharingAnswer) -> String {
        switch answer {
        case .share: askShare
        case .declineNow: askDecline
        }
    }
}
