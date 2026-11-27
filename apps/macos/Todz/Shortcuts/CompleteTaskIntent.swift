import AppIntents
import TodzKit

struct CompleteTaskIntent: AppIntent {
    static let title: LocalizedStringResource = "Complete a Task"
    static let description = IntentDescription("Completes an open task of the active workspace of todz.")

    @Parameter(title: "Task", requestValueDialog: IntentDialog(LocalizedStringResource(stringLiteral: ShortcutsCopy.askTask))) var task: TodzTaskEntity

    static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

    @Dependency private var model: AppModel

    @MainActor
    func perform() async throws -> some ProvidesDialog {
        try await model.requireShortcutReadiness()
        guard let key = TaskKey(shortcutIdentifier: task.id) else { throw ShortcutRefusal.taskGone }
        let completion = await model.completeFromShortcut(key: key)
        switch completion {
        case let .completed(title, isOffline):
            let spoken = ShortcutsCopy.withSyncsLater(ShortcutsCopy.completed(title: title), isOffline: isOffline)
            return .result(dialog: IntentDialog(LocalizedStringResource(stringLiteral: spoken)))
        case let .alreadyDone(title):
            return .result(dialog: IntentDialog(LocalizedStringResource(stringLiteral: ShortcutsCopy.alreadyDone(title: title))))
        case .notFound: throw ShortcutRefusal.taskGone
        case .signedOut: throw ShortcutRefusal.signedOut
        }
    }
}
