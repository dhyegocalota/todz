struct SignInLinkRequestBody: Encodable {
    let email: String
    let linkChallenge: String
    let turnstileToken: String
}
