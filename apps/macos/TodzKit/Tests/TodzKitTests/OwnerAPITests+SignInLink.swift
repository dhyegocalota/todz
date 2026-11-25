import Foundation
import Testing
@testable import TodzKit

private let zone = "America/Sao_Paulo"
private let challenge = "0f007385b6f9d4b7eeb2748605afe1a984a0a3bfa3f014d09e2a784ce9e5cd1a"
private let verifier = String(repeating: "A", count: 43)
private let turnstileToken = "turnstile-token"

extension OwnerAPITests {
    @Test(arguments: [("link", SignInMethod.link), ("identity", .identity)])
    func signInMethodReadsTheMethodWithoutASession(text: String, expected: SignInMethod) async throws {
        let method = try await api(answering: .response(status: 200, body: "{\"method\":\"\(text)\"}")).signInMethod()
        try expectOnlyRequest(ExpectedRequest(method: "GET", path: "/owner/sign-in-method", session: nil, body: nil))
        #expect(method == expected)
    }

    @Test(arguments: [AppLinkScheme.release, .debug])
    func requestSignInLinkPostsTheAddressTheChallengeTheTurnstileTokenAndTheAppsSchemeWithoutASession(linkScheme: AppLinkScheme) async throws {
        try await api(answering: .response(status: 202, body: "{}")).requestSignInLink(email: "maria@example.com", challenge: challenge, turnstileToken: turnstileToken, linkScheme: linkScheme)
        try expectOnlyRequest(
            ExpectedRequest(
                method: "POST",
                path: "/owner/sign-in-links",
                session: nil,
                body: ["email": "maria@example.com", "link_challenge": challenge, "turnstile_token": turnstileToken, "app_link_scheme": linkScheme.rawValue]
            )
        )
    }

    @Test func signInSendsTheLinkVerifierAndTheTurnstileTokenWhenThereAreOnes() async throws {
        let body = "{\"session_token\":\"secret\",\"owner\":\(OwnerFixtures.ownerJSON(identifier: "owner-1", timeZone: zone))}"
        _ = try await api(answering: .response(status: 201, body: body)).signIn(identityToken: "token", linkVerifier: verifier, turnstileToken: turnstileToken, timeZone: zone)
        try expectOnlyRequest(
            ExpectedRequest(
                method: "POST",
                path: "/owner/sessions",
                session: nil,
                body: ["identity_token": "token", "link_verifier": verifier, "turnstile_token": turnstileToken, "time_zone": zone]
            )
        )
    }

    @Test func aRefusedLinkRequestIsRefusedAsSignInRefused() async throws {
        let answer = StubAnswer.response(status: 429, body: "{\"error\":\"sign_in_refused\"}")
        await #expect(throws: OwnerAPIError.signInRefused) {
            try await api(answering: answer).requestSignInLink(email: "maria@example.com", challenge: challenge, turnstileToken: turnstileToken, linkScheme: .release)
        }
    }

    @Test func aRefusedSignInIsRefusedAsSignInRefused() async throws {
        let answer = StubAnswer.response(status: 429, body: "{\"error\":\"sign_in_refused\"}")
        await #expect(throws: OwnerAPIError.signInRefused) {
            try await api(answering: answer).signIn(identityToken: "token", linkVerifier: verifier, turnstileToken: turnstileToken, timeZone: zone)
        }
    }
}
