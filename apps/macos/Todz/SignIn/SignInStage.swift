import TodzKit

@MainActor enum SignInStage: Equatable {
    case methodLoading
    case methodUnavailable
    case identity
    case address
    case sending
    case awaitingLink
    case redeeming

    init(model: AppModel) {
        guard let signInMethod = model.signInMethod else {
            self = model.signInError == nil ? .methodLoading : .methodUnavailable
            return
        }
        guard signInMethod == .link else {
            self = .identity
            return
        }
        let isLinkRefused = model.signInError == .linkRejected || model.signInError == .linkNotRequested || model.signInError == .timeZoneInvalid
        let isWaitingForLink = model.pendingLink != nil && !isLinkRefused
        let isFirstRequest = model.isRequestingLink && model.pendingLink == nil
        if model.isSigningIn {
            self = .redeeming
            return
        }
        if isFirstRequest {
            self = .sending
            return
        }
        self = isWaitingForLink ? .awaitingLink : .address
    }
}
