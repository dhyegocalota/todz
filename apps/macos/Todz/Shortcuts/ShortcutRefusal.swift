import AppIntents
import TodzKit

enum ShortcutRefusal: Error, CustomLocalizedStringResourceConvertible {
    case signedOut
    case noWorkspace
    case loading
    case taskGone
    case noMatch(text: String, workspaceName: String)
    case ambiguous(text: String, titles: [String])
    case rule(RuleIssue)

    init?(_ readiness: ShortcutReadiness) {
        switch readiness {
        case .ready: return nil
        case .signedOut: self = .signedOut
        case .noWorkspace: self = .noWorkspace
        case .loading: self = .loading
        }
    }

    var localizedStringResource: LocalizedStringResource {
        LocalizedStringResource(stringLiteral: text)
    }

    private var text: String {
        switch self {
        case .signedOut: ShortcutsCopy.signedOut
        case .noWorkspace: ShortcutsCopy.noWorkspace
        case .loading: ShortcutsCopy.loading
        case .taskGone: ShortcutsCopy.taskGone
        case let .noMatch(text, workspaceName): ShortcutsCopy.noMatch(text: text, workspaceName: workspaceName)
        case let .ambiguous(text, titles): ShortcutsCopy.ambiguous(text: text, titles: titles)
        case let .rule(issue): issue.copy
        }
    }
}
