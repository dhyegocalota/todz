import TodzKit

extension SignInError {
    var copy: String {
        switch self {
        case .identityRejected: SignInCopy.identityRejected
        case .signInUnavailable: SignInCopy.signInUnavailable
        case .tooManyLinks: SignInCopy.tooManyLinks
        case .tooManyRequests: SignInCopy.tooManyRequests
        case .invalidAddress: SignInCopy.emailFormat
        case .linkRejected: SignInCopy.linkRejected
        case .linkNotRequested: SignInCopy.linkNotRequested
        case .timeZoneInvalid: SignInCopy.timeZoneInvalid
        case .unreachable: ErrorCopy.networkTitle
        case .unexpected: ErrorCopy.serverTitle
        }
    }

    var canTryAgain: Bool {
        switch self {
        case .unreachable, .unexpected: true
        case .identityRejected, .signInUnavailable, .tooManyLinks, .tooManyRequests, .invalidAddress, .linkRejected, .linkNotRequested,
            .timeZoneInvalid:
            false
        }
    }
}
