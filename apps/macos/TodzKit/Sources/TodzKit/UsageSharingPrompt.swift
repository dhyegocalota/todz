public enum UsageSharingAnswer: Sendable, Equatable {
    case share
    case declineNow
}

public enum UsageSharingPrompt {
    public static let buttonsInOrder: [UsageSharingAnswer] = [.declineNow, .share]
    public static let defaultAnswer = UsageSharingAnswer.declineNow
    public static let escapeAnswer = UsageSharingAnswer.declineNow

    public static func answer(forButtonIndex index: Int) -> UsageSharingAnswer {
        buttonsInOrder[index]
    }
}
