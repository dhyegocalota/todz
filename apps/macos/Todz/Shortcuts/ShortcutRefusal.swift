import AppIntents
import TodzKit

enum ShortcutRefusal: Error, CustomLocalizedStringResourceConvertible {
    case signedOut
    case noWorkspace
    case loading
    case taskGone
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
        case let .rule(issue): issue.copy
        }
    }
}

extension AppModel {
    func requireShortcutReadiness() async throws {
        let readiness = await shortcutReadiness()
        guard let refusal = ShortcutRefusal(readiness) else { return }
        throw refusal
    }
}
