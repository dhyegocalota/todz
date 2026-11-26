public enum OwnerKeyFailure: Equatable, Sendable {
    case limitReached
    case notCreated
    case notRevoked
    case refused(message: String)

    init(creating error: any Error) {
        switch error as? OwnerAPIError {
        case .limitReached: self = .limitReached
        case let .fairUseRefused(message): self = .refused(message: message)
        default: self = .notCreated
        }
    }
}
