import TodzKit

extension SignInNotice {
    var copy: String {
        switch self {
        case .sessionEnded: SignInCopy.sessionEnded
        case .sessionUnreadable: SignInCopy.sessionUnreadable
        }
    }
}
