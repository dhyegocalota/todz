import AppIntents
import TodzKit

struct AddTaskIntent: AppIntent {
    static let title: LocalizedStringResource = "Add a Task"
    static let description = IntentDescription("Adds a task to the Inbox of the active workspace of todz, due today unless Due Today is off.")

    @Parameter(title: "Title", requestValueDialog: IntentDialog(LocalizedStringResource(stringLiteral: ShortcutsCopy.askTitle))) var taskTitle: String
    @Parameter(title: "Due Today", default: true) var isDueToday: Bool

    static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

    @Dependency private var model: AppModel

    @MainActor
    func perform() async throws -> some ReturnsValue<String> & ProvidesDialog {
        try await model.requireShortcutReadiness()
        let addition = await model.addFromShortcut(title: taskTitle, isDueToday: isDueToday)
        switch addition {
        case let .added(title, destination, workspaceName, isOffline):
            let sentence = ShortcutsCopy.added(title: title, destination: destination, workspaceName: workspaceName)
            let spoken = ShortcutsCopy.withSyncsLater(sentence, isOffline: isOffline)
            return .result(value: title, dialog: IntentDialog(LocalizedStringResource(stringLiteral: spoken)))
        case let .refused(issue): throw ShortcutRefusal.rule(issue)
        case .noWorkspace: throw ShortcutRefusal.noWorkspace
        case .signedOut: throw ShortcutRefusal.signedOut
        }
    }
}
