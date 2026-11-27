public enum MenuBarLoad: Equatable, Sendable {
    case loading
    case failed
    case loaded
}

public enum MenuBarScreen: Equatable, Sendable {
    case loading
    case failed
    case dayClosed
    case closingDay
    case empty
    case allDone
    case active
}

public struct MenuBarDay: Equatable, Sendable {
    public let screen: MenuBarScreen
    public let upNext: BoardTask?
    public let queue: [BoardTask]
    public let leftCount: Int
    public let doneCount: Int
    public let progress: Double

    public init(open: [BoardTask], doneToday: [BoardTask], pendingCount: Int, isClosingDay: Bool, load: MenuBarLoad) {
        let lingeringDone = open.filter { $0.task.state == .done }
        leftCount = open.count - lingeringDone.count
        doneCount = doneToday.count + lingeringDone.count
        let total = leftCount + doneCount
        progress = total == 0 ? 0 : Double(doneCount) / Double(total)
        let hasNothingLeft = open.isEmpty && pendingCount == 0
        screen = Self.screen(hasNothingLeft: hasNothingLeft, hasDoneToday: !doneToday.isEmpty, isClosingDay: isClosingDay, load: load)
        upNext = isClosingDay ? nil : open.first
        queue = isClosingDay ? open : Array(open.dropFirst())
    }

    private static func screen(hasNothingLeft: Bool, hasDoneToday: Bool, isClosingDay: Bool, load: MenuBarLoad) -> MenuBarScreen {
        guard load != .failed else { return .failed }
        guard load != .loading else { return .loading }
        guard !isClosingDay else { return hasNothingLeft ? .dayClosed : .closingDay }
        guard hasNothingLeft else { return .active }
        return hasDoneToday ? .allDone : .empty
    }
}
