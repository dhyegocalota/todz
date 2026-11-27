public enum MenuBarFocus: Hashable, Sendable {
    case composer
    case row(TaskKey)
    case doneToday
}

public enum MenuBarDirection: Sendable {
    case up
    case down
}

public enum MenuBarNavigation {
    public static func targets(hasComposer: Bool, rows: [TaskKey], hasDoneToday: Bool) -> [MenuBarFocus] {
        let composer: [MenuBarFocus] = hasComposer ? [.composer] : []
        let done: [MenuBarFocus] = hasDoneToday ? [.doneToday] : []
        return composer + rows.map { MenuBarFocus.row($0) } + done
    }

    public static func next(from current: MenuBarFocus?, direction: MenuBarDirection, in targets: [MenuBarFocus]) -> MenuBarFocus? {
        guard let first = targets.first else { return nil }
        guard let current, let index = targets.firstIndex(of: current) else { return targets.contains(.composer) ? .composer : first }
        let step = direction == .down ? 1 : -1
        let stepped = min(max(index + step, targets.startIndex), targets.endIndex - 1)
        return targets[stepped]
    }
}
