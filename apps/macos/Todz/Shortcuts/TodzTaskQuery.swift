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
        guard let workspace = model.activeWorkspace else { throw ShortcutRefusal.noWorkspace }
        switch model.shortcutResolution(matching: string) {
        case let .one(task): return [TodzTaskEntity(task: task)]
        case let .many(tasks): throw ShortcutRefusal.ambiguous(text: string, titles: tasks.prefix(ShortcutLimits.spokenTitleLimit).map(\.title))
        case .none: throw ShortcutRefusal.noMatch(text: string, workspaceName: workspace.name)
        }
    }

    @MainActor
    func suggestedEntities() async throws -> [TodzTaskEntity] {
        try await model.requireShortcutReadiness()
        return model.shortcutSuggestedTasks.map(TodzTaskEntity.init)
    }
}
