struct SignInLinkRequestBody: Encodable {
    let email: String
    let linkChallenge: String
    let turnstileToken: String
    let appLinkScheme: AppLinkScheme

    private enum CodingKeys: String, CodingKey {
        case email
        case linkChallenge
        case turnstileToken
    }
}
