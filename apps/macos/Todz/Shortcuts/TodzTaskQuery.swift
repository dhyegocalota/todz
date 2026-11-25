import AppIntents
import TodzKit

struct TodzTaskQuery: EntityStringQuery {
    @Dependency private var model: AppModel

    @MainActor
    func entities(for identifiers: [String]) async throws -> [TodzTaskEntity] {
        try await model.requireShortcutReadiness()
        let keys = identifiers.compactMap { TaskKey(shortcutIdentifier: $0) }
        return model.shortcutTasks(for: keys).map(TodzTaskEntity.init)
    }

    @MainActor
    func entities(matching string: String) async throws -> [TodzTaskEntity] {
        try await model.requireShortcutReadiness()
        return model.shortcutTasks(matching: string).map(TodzTaskEntity.init)
    }

    @MainActor
    func suggestedEntities() async throws -> [TodzTaskEntity] {
        try await model.requireShortcutReadiness()
        return model.shortcutSuggestedTasks.map(TodzTaskEntity.init)
    }
}
