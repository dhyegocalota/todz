public enum RibbonContent: Equatable, Sendable {
    case remaining(left: Int, next: RibbonTask)
    case last(RibbonTask)

    public static func of(open: [BoardTask]?) -> RibbonContent? {
        guard let open, let first = open.first else { return nil }
        let next = RibbonTask(number: first.task.number, title: first.task.title)
        guard open.count > 1 else { return .last(next) }
        return .remaining(left: open.count, next: next)
    }
}
