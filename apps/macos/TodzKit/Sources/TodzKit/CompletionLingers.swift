public struct CompletionLingers: Sendable, Equatable {
    public init() {}

    public func contains(task key: TaskKey) -> Bool {
        fatalError("CompletionLingers.contains is not implemented")
    }

    public func toggling(task key: TaskKey, in item: SidebarItem, views: TaskViews) -> CompletionLingers {
        fatalError("CompletionLingers.toggling is not implemented")
    }

    public func ending(task key: TaskKey) -> CompletionLingers {
        fatalError("CompletionLingers.ending is not implemented")
    }

    public func placed(into tasks: [BoardTask], item: SidebarItem, views: TaskViews) -> [BoardTask] {
        fatalError("CompletionLingers.placed is not implemented")
    }

    public func lingeringKeys(item: SidebarItem, views: TaskViews) -> Set<TaskKey> {
        fatalError("CompletionLingers.lingeringKeys is not implemented")
    }
}
