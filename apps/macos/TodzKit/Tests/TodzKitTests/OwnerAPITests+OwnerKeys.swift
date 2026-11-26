import Foundation
import Testing
@testable import TodzKit

private let keyIdentifier = UUID().uuidString.lowercased()
private let ownerSecret = "todz-owner_yMnKy8zNzs_Q0dLT1NXW19jZ2tvc3d7f4OHi4-Tl5uc"

extension OwnerAPITests {
    @Test func listOwnerKeysUnwrapsTheKeys() async throws {
        let body = "{\"keys\":[\(OwnerFixtures.projectKeyJSON(identifier: keyIdentifier))]}"
        let keys = try await api(answering: .response(status: 200, body: body)).listOwnerKeys(session: session)
        try expectOnlyRequest(ExpectedRequest(method: "GET", path: "/owner/keys", session: session, body: nil))
        #expect(keys == [OwnerFixtures.projectKey(identifier: keyIdentifier)])
    }

    @Test func issueOwnerKeyPostsWithoutABodyAndReturnsTheSecret() async throws {
        let body = "{\"key\":\(OwnerFixtures.projectKeyJSON(identifier: keyIdentifier)),\"secret\":\"\(ownerSecret)\"}"
        let issued = try await api(answering: .response(status: 201, body: body)).issueOwnerKey(session: session)
        try expectOnlyRequest(ExpectedRequest(method: "POST", path: "/owner/keys", session: session, body: nil))
        #expect(issued == IssuedKey(key: OwnerFixtures.projectKey(identifier: keyIdentifier), secret: ownerSecret))
    }

    @Test func revokeOwnerKeyDeletesTheKey() async throws {
        try await api(answering: .response(status: 204, body: "")).revokeOwnerKey(session: session, keyIdentifier: keyIdentifier)
        try expectOnlyRequest(ExpectedRequest(method: "DELETE", path: "/owner/keys/\(keyIdentifier)", session: session, body: nil))
    }

    @Test func issuingPastTheLimitIsALimitRefusal() async throws {
        let api = try api(answering: .response(status: 409, body: "{\"error\":\"limit_reached\"}"))
        await #expect(throws: OwnerAPIError.limitReached) { try await api.issueOwnerKey(session: session) }
    }

    @Test func revokingAnAbsentKeyIsNotFound() async throws {
        let api = try api(answering: .response(status: 404, body: "{\"error\":\"not_found\"}"))
        await #expect(throws: OwnerAPIError.notFound) { try await api.revokeOwnerKey(session: session, keyIdentifier: keyIdentifier) }
    }
}
