public enum SignInStage: Equatable, Sendable {
    case methodLoading
    case methodUnavailable
    case identity
    case address
    case sending
    case awaitingLink
    case redeeming

    @MainActor public init(model: AppModel) {
        self = .methodLoading
    }
}
