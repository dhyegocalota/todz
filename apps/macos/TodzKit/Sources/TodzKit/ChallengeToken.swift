private let maximumLength = 2048

enum ChallengeToken {
    static func isWellFormed(_ token: String) -> Bool {
        token.count <= maximumLength && token.wholeMatch(of: /[A-Za-z0-9._-]+/) != nil
    }
}
