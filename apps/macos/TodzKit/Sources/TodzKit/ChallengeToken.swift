enum ChallengeToken {
    static func isWellFormed(_ token: String) -> Bool {
        token.wholeMatch(of: /[A-Za-z0-9._-]{1,2048}/) != nil
    }
}
