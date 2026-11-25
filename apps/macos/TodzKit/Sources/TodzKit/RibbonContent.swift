public enum RibbonContent: Equatable, Sendable {
    case remaining(left: Int, next: RibbonTask)
    case last(RibbonTask)

    public static func of(open: [BoardTask]?) -> RibbonContent? {
        fatalError("RibbonContent.of is not implemented")
    }
}
