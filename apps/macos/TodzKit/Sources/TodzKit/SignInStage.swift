public enum SignInStage: Equatable, Sendable {
    case methodLoading
    case methodUnavailable
    case identity
    case address
    case sending
    case awaitingLink
    case redeeming

    @MainActor public init(model: AppModel) {
        let isRedeeming = model.isSigningIn && !model.isSubmittingCode && model.signInMethod != .identity
        guard !isRedeeming else {
            self = .redeeming
            return
        }
        guard let signInMethod = model.signInMethod else {
            self = model.signInMethodError == nil ? .methodLoading : .methodUnavailable
            return
        }
        guard signInMethod == .link else {
            self = .identity
            return
        }
        let isLinkRefused = model.signInError == .linkRejected || model.signInError == .linkNotRequested || model.signInError == .timeZoneInvalid
        let isWaitingForLink = model.pendingLink != nil && !isLinkRefused
        let isFirstRequest = model.isRequestingLink && model.pendingLink == nil
        guard !isFirstRequest else {
            self = .sending
            return
        }
        self = isWaitingForLink ? .awaitingLink : .address
    }
}
