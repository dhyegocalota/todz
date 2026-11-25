import TodzKit

extension AppModel {
    var missingChallengeReason: String? {
        guard signInChallengeToken == nil else { return nil }
        return SignInCopy.challengeRequired
    }
}
