private typealias LingeringTask = (index: Int, task: BoardTask)

private struct CompletionLinger: Sendable, Equatable {
    let item: SidebarItem
    let index: Int
}

private func keyOf(_ boardTask: BoardTask) -> TaskKey {
    TaskKey(projectIdentifier: boardTask.project.identifier, number: boardTask.task.number)
}

private func isEarlierLinger(_ lhs: (key: TaskKey, value: CompletionLinger), _ rhs: (key: TaskKey, value: CompletionLinger)) -> Bool {
    guard lhs.value.index == rhs.value.index else { return lhs.value.index < rhs.value.index }
    return lhs.key.number < rhs.key.number
}

public struct CompletionLingers: Sendable, Equatable {
    private var lingers: [TaskKey: CompletionLinger] = [:]

    public init() {}

    private init(lingers: [TaskKey: CompletionLinger]) {
        self.lingers = lingers
    }

    public func contains(task key: TaskKey) -> Bool {
        lingers[key] != nil
    }

    public func toggling(task key: TaskKey, in item: SidebarItem, views: TaskViews) -> CompletionLingers {
        let ended = ending(task: key)
        guard let openTasks = Self.openTasks(of: item, views: views) else { return ended }
        let shownTasks = placed(into: openTasks, item: item, views: views)
        let index = shownTasks.firstIndex { keyOf($0) == key && $0.task.state == .open }
        guard let index else { return ended }
        var started = lingers
        started[key] = CompletionLinger(item: item, index: index)
        return CompletionLingers(lingers: started)
    }

    public func ending(task key: TaskKey) -> CompletionLingers {
        var ended = lingers
        ended[key] = nil
        return CompletionLingers(lingers: ended)
    }

    public func placed(into tasks: [BoardTask], item: SidebarItem, views: TaskViews) -> [BoardTask] {
        lingeringTasks(item: item, views: views).reduce(tasks) { shown, lingering in
            let isShown = shown.contains { keyOf($0) == keyOf(lingering.task) }
            guard !isShown else { return shown }
            var placed = shown
            placed.insert(lingering.task, at: min(lingering.index, shown.count))
            return placed
        }
    }

    public func lingeringKeys(item: SidebarItem, views: TaskViews) -> Set<TaskKey> {
        Set(lingeringTasks(item: item, views: views).map { keyOf($0.task) })
    }

    public static func placement(moving index: Int, toOffset offset: Int, in shownTasks: [BoardTask]) -> TaskPlacement? {
        fatalError("CompletionLingers.placement is not implemented")
    }

    private func lingeringTasks(item: SidebarItem, views: TaskViews) -> [LingeringTask] {
        let itemLingers = lingers.filter { $0.value.item == item }
        guard !itemLingers.isEmpty else { return [] }
        let doneTasks = views.done
        return itemLingers.sorted(by: isEarlierLinger).compactMap { key, linger in
            doneTasks.first { keyOf($0) == key }.map { (index: linger.index, task: $0) }
        }
    }

    private static func openTasks(of item: SidebarItem, views: TaskViews) -> [BoardTask]? {
        switch item {
        case .inbox: views.inbox
        case let .project(identifier): views.project(identifier: identifier)
        case .today: views.today.open
        case .upcoming, .done: nil
        }
    }
}
