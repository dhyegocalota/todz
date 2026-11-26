import TodzKit

extension SignInError {
    var copy: String {
        switch self {
        case .identityRejected: SignInCopy.identityRejected
        case .signInUnavailable: SignInCopy.signInUnavailable
        case .signInRefused: SignInCopy.signInRefused
        case .invalidAddress: SignInCopy.emailFormat
        case .linkRejected: SignInCopy.linkRejected
        case .linkNotRequested: SignInCopy.linkNotRequested
        case .linkRefused: SignInCopy.linkRefused
        case .timeZoneInvalid: SignInCopy.timeZoneInvalid
        case .appTooOld: SignInCopy.appTooOld
        case let .fairUseRefused(message): message
        case .unreachable: ErrorCopy.networkTitle
        case .unexpected: ErrorCopy.serverTitle
        }
    }

    var canTryAgain: Bool {
        switch self {
        case .unreachable, .unexpected: true
        case .identityRejected, .signInUnavailable, .signInRefused, .invalidAddress, .linkRejected, .linkNotRequested, .linkRefused,
            .timeZoneInvalid, .appTooOld, .fairUseRefused:
            false
        }
    }
}
