import TodzKit

extension SignInError {
    var copy: String {
        switch self {
        case .identityRejected: SignInCopy.identityRejected
        case .signInUnavailable: SignInCopy.signInUnavailable
        case .timeZoneInvalid: SignInCopy.timeZoneInvalid
        case .unreachable: ErrorCopy.networkTitle
        case .unexpected: ErrorCopy.serverTitle
        }
    }

    var canTryAgain: Bool {
        switch self {
        case .unreachable, .unexpected: true
        case .identityRejected, .signInUnavailable, .timeZoneInvalid: false
        }
    }
}
