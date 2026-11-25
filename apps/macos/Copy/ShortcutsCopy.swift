import Foundation
import TodzKit

enum ShortcutsCopy {
    static let askTitle = "What's the task?"
    static let askTask = "Which task?"
    static let offline = "todz is offline, so this is the last synced list."
    static let syncsLater = "It syncs when todz is back online."
    static let taskGone = "That task is no longer in this workspace."
    static let signedOut = "Sign in to todz first."
    static let noWorkspace = "Name your first workspace in todz first."
    static let loading = "todz is still loading Today. Try again in a moment."

    static func nothingLeft(workspaceName: String) -> String {
        "Nothing left today in \(workspaceName)."
    }

    static func left(count: Int, workspaceName: String) -> String {
        InflectedCopy.text("\(count) left today in \(workspaceName).")
    }

    static func leftWithTitles(count: Int, workspaceName: String, titles: [String]) -> String {
        let spokenTitles = titles.formatted(.list(type: .and))
        return InflectedCopy.text("\(count) left today in \(workspaceName): \(spokenTitles).")
    }

    static func leftWithFirstTitles(count: Int, workspaceName: String, titles: [String]) -> String {
        let spokenTitles = titles.formatted(.list(type: .and))
        return InflectedCopy.text("\(count) left today in \(workspaceName). The first \(spokenTitleLimitInWords): \(spokenTitles).")
    }

    static func spoken(for today: ShortcutToday) -> String {
        withOfflineNotice(spokenSentence(for: today), isOffline: today.isOffline)
    }

    static func supporting(for today: ShortcutToday) -> String {
        let isNothingLeft = today.sentence == .nothingLeft
        let sentence = isNothingLeft
            ? nothingLeft(workspaceName: today.workspaceName)
            : left(count: today.content.openCount, workspaceName: today.workspaceName)
        return withOfflineNotice(sentence, isOffline: today.isOffline)
    }

    static func added(title: String, destination: ShortcutAddDestination, workspaceName: String) -> String {
        switch destination {
        case .today: "Added “\(title)” to Today in \(workspaceName)."
        case .inbox: "Added “\(title)” to the Inbox in \(workspaceName)."
        }
    }

    static func completed(title: String) -> String {
        "Done: “\(title)”."
    }

    static func alreadyDone(title: String) -> String {
        "“\(title)” is already done."
    }

    static func withSyncsLater(_ sentence: String, isOffline: Bool) -> String {
        isOffline ? "\(sentence) \(syncsLater)" : sentence
    }

    private static func withOfflineNotice(_ sentence: String, isOffline: Bool) -> String {
        isOffline ? "\(sentence) \(offline)" : sentence
    }

    private static var spokenTitleLimitInWords: String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.numberStyle = .spellOut
        guard let words = formatter.string(from: NSNumber(value: ShortcutLimits.spokenTitleLimit)) else {
            preconditionFailure("a whole number always spells out")
        }
        return words
    }

    private static func spokenSentence(for today: ShortcutToday) -> String {
        let count = today.content.openCount
        switch today.sentence {
        case .nothingLeft: return nothingLeft(workspaceName: today.workspaceName)
        case .withTitles: return leftWithTitles(count: count, workspaceName: today.workspaceName, titles: today.spokenTitles)
        case .withFirstTitles: return leftWithFirstTitles(count: count, workspaceName: today.workspaceName, titles: today.spokenTitles)
        }
    }
}
