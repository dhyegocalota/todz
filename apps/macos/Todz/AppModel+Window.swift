import TodzKit

extension AppModel {
    var isSignedIn: Bool {
        guard case .signedOut = phase else { return true }
        return false
    }
}
