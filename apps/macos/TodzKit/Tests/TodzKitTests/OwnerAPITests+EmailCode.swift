import Foundation
import Testing
@testable import TodzKit

private let timeZone = "America/Sao_Paulo"
private let verifier = String(repeating: "v", count: 43)
private let connectedAppIdentifier = "grant-1"

extension OwnerAPITests {
    @Test func signingInWithACodeSendsTheEmailTheCodeTheVerifierAndNoIdentityToken() async throws {
        let sessionToken = UUID().uuidString
        let ownerIdentifier = UUID().uuidString
        let body = "{\"session_token\":\"\(sessionToken)\",\"owner\":\(OwnerFixtures.ownerJSON(identifier: ownerIdentifier, timeZone: timeZone))}"
        let issued = try await api(answering: .response(status: 201, body: body)).signIn(email: "maria@example.com", emailCode: "482913", linkVerifier: verifier, turnstileToken: "turnstile", timeZone: timeZone)
        try expectOnlyRequest(
            ExpectedRequest(
                method: "POST",
                path: "/owner/sessions",
                session: nil,
                body: ["email": "maria@example.com", "email_code": "482913", "link_verifier": verifier, "turnstile_token": "turnstile", "time_zone": timeZone]
            )
        )
        #expect(issued.sessionToken == sessionToken)
    }

    @Test func aWrongCodeIsAnIdentityRejection() async throws {
        let api = try api(answering: .response(status: 401, body: "{\"error\":\"identity_rejected\"}"))
        await #expect(throws: OwnerAPIError.identityRejected) {
            try await api.signIn(email: "maria@example.com", emailCode: "000000", linkVerifier: verifier, turnstileToken: "t", timeZone: timeZone)
        }
    }

    @Test func tooManyWrongCodesCarryTheSecondsToWait() async throws {
        let answer = StubAnswer.responseWithHeaders(status: 429, body: "{\"error\":\"code_locked\"}", headers: ["Retry-After": "120"])
        let api = try api(answering: answer)
        await #expect(throws: OwnerAPIError.codeLocked(retryAfterSeconds: 120)) {
            try await api.signIn(email: "maria@example.com", emailCode: "000000", linkVerifier: verifier, turnstileToken: "t", timeZone: timeZone)
        }
    }

    @Test func aLockedAnswerWithNoWaitSaysSoInsteadOfInventingOne() async throws {
        let api = try api(answering: .response(status: 429, body: "{\"error\":\"code_locked\"}"))
        await #expect(throws: OwnerAPIError.codeLocked(retryAfterSeconds: nil)) {
            try await api.signIn(email: "maria@example.com", emailCode: "000000", linkVerifier: verifier, turnstileToken: "t", timeZone: timeZone)
        }
    }

    @Test func narrowingAGrantPatchesTheKeptScopesByIdentifierOnly() async throws {
        let answer = "{\"connected_app\":\(ConnectedAppFixtures.ownerScopedJSON(identifier: connectedAppIdentifier))}"
        let narrowed = try await api(answering: .response(status: 200, body: answer)).narrowConnectedApp(
            session: session,
            connectedAppIdentifier: connectedAppIdentifier,
            scopes: [.workspace(identifier: "w1", name: "Thrifty Traveler"), .project(identifier: "p9", name: "Inbox", workspaceIdentifier: "w2", workspaceName: "Personal")]
        )
        try expectOnlyRequest(
            ExpectedRequest(
                method: "PATCH",
                path: "/owner/connected-apps/\(connectedAppIdentifier)",
                session: session,
                body: ["scopes": [["kind": "workspace", "workspace_id": "w1"], ["kind": "project", "project_id": "p9"]]]
            )
        )
        #expect(narrowed.identifier == connectedAppIdentifier)
    }

    @Test func aScopeTheGrantDoesNotCoverIsNotNarrower() async throws {
        let api = try api(answering: .response(status: 422, body: "{\"error\":\"scope_not_narrower\"}"))
        await #expect(throws: OwnerAPIError.scopeNotNarrower) {
            try await api.narrowConnectedApp(session: session, connectedAppIdentifier: connectedAppIdentifier, scopes: [.account])
        }
    }

    @Test func narrowingAnAbsentGrantIsNotFound() async throws {
        let api = try api(answering: .response(status: 404, body: "{\"error\":\"not_found\"}"))
        await #expect(throws: OwnerAPIError.notFound) {
            try await api.narrowConnectedApp(session: session, connectedAppIdentifier: connectedAppIdentifier, scopes: [.account])
        }
    }
}
