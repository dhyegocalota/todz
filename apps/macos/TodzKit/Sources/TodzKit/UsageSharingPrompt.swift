public enum UsageSharingAnswer: Sendable, Equatable {
    case share
    case declineNow
}

public enum UsageSharingPrompt {
    public static let buttonsInOrder: [UsageSharingAnswer] = [.declineNow, .share]
    public static let defaultAnswer = UsageSharingAnswer.declineNow
    public static let escapeAnswer = UsageSharingAnswer.declineNow
    public static let escapeKeyCode: UInt16 = 53

    public static func answer(forButtonIndex index: Int) -> UsageSharingAnswer? {
        guard buttonsInOrder.indices.contains(index) else { return nil }
        return buttonsInOrder[index]
    }

    public static func isEscape(keyCode: UInt16) -> Bool {
        keyCode == escapeKeyCode
    }
}
