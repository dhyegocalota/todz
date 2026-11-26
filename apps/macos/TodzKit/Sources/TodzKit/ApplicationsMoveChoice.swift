public enum ApplicationsMoveChoice: Sendable {
    case notNow
    case move

    public static let alertButtonOrder: [ApplicationsMoveChoice] = [.notNow, .move]
    public static let defaultChoice = ApplicationsMoveChoice.notNow

    public static func of(alertButtonIndex: Int) -> ApplicationsMoveChoice? {
        guard alertButtonOrder.indices.contains(alertButtonIndex) else { return nil }
        return alertButtonOrder[alertButtonIndex]
    }
}
