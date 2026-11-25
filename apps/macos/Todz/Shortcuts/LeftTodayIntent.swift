import AppIntents
import TodzKit

struct LeftTodayIntent: AppIntent {
    static let title: LocalizedStringResource = "What's Left Today"
    static let description = IntentDescription("Tells what is left today in the active workspace of todz.")

    @Dependency private var model: AppModel

    @MainActor
    func perform() async throws -> some ReturnsValue<[TodzTaskEntity]> & ProvidesDialog & ShowsSnippetView {
        try await model.requireShortcutReadiness()
        guard let today = model.shortcutToday else { throw ShortcutRefusal.loading }
        let dialog = IntentDialog(
            full: LocalizedStringResource(stringLiteral: ShortcutsCopy.spoken(for: today)),
            supporting: LocalizedStringResource(stringLiteral: ShortcutsCopy.supporting(for: today))
        )
        return .result(value: today.tasks.map(TodzTaskEntity.init), dialog: dialog, view: LeftTodaySnippet(today: today))
    }
}
