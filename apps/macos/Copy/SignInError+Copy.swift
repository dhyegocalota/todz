import TodzKit

extension SignInError {
    var copy: String {
        switch self {
        case .identityRejected: SignInCopy.identityRejected
        case .codeRejected: SignInCopy.codeRejected
        case let .codeLocked(retryAfterSeconds): SignInCopy.codeLocked(retryAfterSeconds: retryAfterSeconds)
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
        case .identityRejected, .codeRejected, .codeLocked, .signInUnavailable, .signInRefused, .invalidAddress, .linkRejected, .linkNotRequested, .linkRefused,
            .timeZoneInvalid, .appTooOld, .fairUseRefused:
            false
        }
    }
}
