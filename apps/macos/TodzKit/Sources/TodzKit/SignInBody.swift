struct EmailCodeSignInBody: Encodable {
    let email: String
    let emailCode: String
    let linkVerifier: String
    let turnstileToken: String
    let timeZone: String
}

struct SignInBody: Encodable {
    let identityToken: String
    let linkVerifier: String?
    let turnstileToken: String?
    let timeZone: String
}
