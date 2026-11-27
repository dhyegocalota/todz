import Foundation
import TodzKit

enum ShortcutsCopy {
    static var askTitle: String { Localized.text("What's the task?") }
    static var askTask: String { Localized.text("Which task?") }
    static var offline: String { Localized.text("todz is offline, so this is the last synced list.") }
    static var syncsLater: String { Localized.text("It syncs when todz is back online.") }
    static var taskGone: String { Localized.text("That task is no longer in this workspace.") }
    static var signedOut: String { Localized.text("Sign in to todz first.") }
    static var noWorkspace: String { Localized.text("Name your first workspace in todz first.") }
    static var choosing: String { Localized.text("Choose a workspace in todz first.") }
    static var loading: String { Localized.text("todz is still loading Today. Try again in a moment.") }

    static func nothingLeft(workspaceName: String) -> String {
        Localized.text("Nothing left today in \(workspaceName).")
    }

    static func left(count: Int, workspaceName: String) -> String {
        Localized.text("\(count) left today in \(workspaceName).")
    }

    static func leftWithTitles(count: Int, workspaceName: String, titles: [String]) -> String {
        let spokenTitles = titles.formatted(.list(type: .and).locale(Localized.locale))
        return Localized.text("\(count) left today in \(workspaceName): \(spokenTitles).")
    }

    static func leftWithFirstTitles(count: Int, workspaceName: String, titles: [String]) -> String {
        let spokenTitles = titles.formatted(.list(type: .and).locale(Localized.locale))
        return Localized.text("\(count) left today in \(workspaceName). The first \(spokenTitleLimitInWords): \(spokenTitles).")
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
        case .today: Localized.text("Added “\(title)” to Today in \(workspaceName).")
        case .inbox: Localized.text("Added “\(title)” to the Inbox in \(workspaceName).")
        }
    }

    static func noMatch(text: String, workspaceName: String) -> String {
        Localized.text("No open task in \(workspaceName) matches “\(text)”.")
    }

    static func ambiguous(text: String, titles: [String]) -> String {
        let listedTitles = titles.map { "“\($0)”" }.formatted(.list(type: .and).locale(Localized.locale))
        return Localized.text("More than one open task matches “\(text)”: \(listedTitles). Say more of the title.")
    }

    static func completed(title: String) -> String {
        Localized.text("Done: “\(title)”.")
    }

    static func alreadyDone(title: String) -> String {
        Localized.text("“\(title)” is already done.")
    }

    static func withSyncsLater(_ sentence: String, isOffline: Bool) -> String {
        isOffline ? Localized.text("\(sentence) \(syncsLater)") : sentence
    }

    private static func withOfflineNotice(_ sentence: String, isOffline: Bool) -> String {
        isOffline ? Localized.text("\(sentence) \(offline)") : sentence
    }

    private static var spokenTitleLimitInWords: String {
        let formatter = NumberFormatter()
        formatter.locale = Localized.locale
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
