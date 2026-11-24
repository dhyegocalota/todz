import Foundation
import Testing
@testable import TodzKit

private let zone = "America/Sao_Paulo"
private let challenge = "0f007385b6f9d4b7eeb2748605afe1a984a0a3bfa3f014d09e2a784ce9e5cd1a"
private let verifier = String(repeating: "A", count: 43)

extension OwnerAPITests {
    @Test(arguments: [("link", SignInMethod.link), ("identity", .identity)])
    func signInMethodReadsTheMethodWithoutASession(text: String, expected: SignInMethod) async throws {
        let method = try await api(answering: .response(status: 200, body: "{\"method\":\"\(text)\"}")).signInMethod()
        try expectOnlyRequest(ExpectedRequest(method: "GET", path: "/owner/sign-in-method", session: nil, body: nil))
        #expect(method == expected)
    }

    @Test func requestSignInLinkPostsTheAddressAndTheChallengeWithoutASession() async throws {
        try await api(answering: .response(status: 202, body: "{}")).requestSignInLink(email: "maria@example.com", challenge: challenge)
        try expectOnlyRequest(
            ExpectedRequest(
                method: "POST",
                path: "/owner/sign-in-links",
                session: nil,
                body: ["email": "maria@example.com", "link_challenge": challenge]
            )
        )
    }

    @Test func signInSendsTheLinkVerifierWhenThereIsOne() async throws {
        let body = "{\"session_token\":\"secret\",\"owner\":\(OwnerFixtures.ownerJSON(identifier: "owner-1", timeZone: zone))}"
        _ = try await api(answering: .response(status: 201, body: body)).signIn(identityToken: "token", linkVerifier: verifier, timeZone: zone)
        try expectOnlyRequest(
            ExpectedRequest(
                method: "POST",
                path: "/owner/sessions",
                session: nil,
                body: ["identity_token": "token", "link_verifier": verifier, "time_zone": zone]
            )
        )
    }

    @Test func aSixthLinkIsRefusedAsTooManyLinks() async throws {
        let answer = StubAnswer.response(status: 429, body: "{\"error\":\"too_many_links\"}")
        await #expect(throws: OwnerAPIError.tooManyLinks) {
            try await api(answering: answer).requestSignInLink(email: "maria@example.com", challenge: challenge)
        }
    }

    @Test func aRateLimitedLinkRequestIsRefusedAsTooManyRequests() async throws {
        let answer = StubAnswer.response(status: 429, body: "{\"error\":\"too_many_requests\"}")
        await #expect(throws: OwnerAPIError.tooManyRequests) {
            try await api(answering: answer).requestSignInLink(email: "maria@example.com", challenge: challenge)
        }
    }

    @Test func aRateLimitedSignInIsRefusedAsTooManyRequests() async throws {
        let answer = StubAnswer.response(status: 429, body: "{\"error\":\"too_many_requests\"}")
        await #expect(throws: OwnerAPIError.tooManyRequests) {
            try await api(answering: answer).signIn(identityToken: "token", linkVerifier: verifier, timeZone: zone)
        }
    }
}
