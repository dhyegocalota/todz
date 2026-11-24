struct SignInBody: Encodable {
    let identityToken: String
    let linkVerifier: String?
    let timeZone: String
}
