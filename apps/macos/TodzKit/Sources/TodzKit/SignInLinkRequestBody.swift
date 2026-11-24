struct SignInLinkRequestBody: Encodable {
    let email: String
    let linkChallenge: String
}
