import Foundation
import Testing
@testable import TodzKit

private let keyIdentifier = UUID().uuidString.lowercased()
private let keyFailures: [(Int, String, OwnerAPIError)] = [
    (404, "{\"error\":\"not_found\"}", .notFound),
    (401, "", .unauthorized),
    (500, "", .unexpected(status: 500)),
]

enum KeyRequestKind: CaseIterable {
    case list
    case issue
    case revoke

    func send(api: OwnerAPI, session: String, projectIdentifier: String) async throws {
        switch self {
        case .list: _ = try await api.listKeys(session: session, projectIdentifier: projectIdentifier)
        case .issue: _ = try await api.issueKey(session: session, projectIdentifier: projectIdentifier)
        case .revoke: try await api.revokeKey(session: session, projectIdentifier: projectIdentifier, keyIdentifier: keyIdentifier)
        }
    }
}

extension OwnerAPITests {
    @Test func listKeysUnwrapsTheKeys() async throws {
        let body = "{\"keys\":[\(OwnerFixtures.projectKeyJSON(identifier: keyIdentifier))]}"
        let keys = try await api(answering: .response(status: 200, body: body)).listKeys(session: session, projectIdentifier: projectIdentifier)
        try expectOnlyRequest(ExpectedRequest(method: "GET", path: "/owner/projects/\(projectIdentifier)/keys", session: session, body: nil))
        #expect(keys == [OwnerFixtures.projectKey(identifier: keyIdentifier)])
    }

    @Test func issueKeyPostsWithoutABodyAndReturnsTheSecret() async throws {
        let body = OwnerFixtures.issuedKeyJSON(identifier: keyIdentifier)
        let issued = try await api(answering: .response(status: 201, body: body)).issueKey(session: session, projectIdentifier: projectIdentifier)
        try expectOnlyRequest(ExpectedRequest(method: "POST", path: "/owner/projects/\(projectIdentifier)/keys", session: session, body: nil))
        #expect(StubURLProtocol.recordedRequests().map(\.contentType) == [nil])
        #expect(issued == IssuedKey(key: OwnerFixtures.projectKey(identifier: keyIdentifier), secret: OwnerFixtures.keySecret))
    }

    @Test func revokeKeyDeletesTheKey() async throws {
        try await api(answering: .response(status: 204, body: ""))
            .revokeKey(session: session, projectIdentifier: projectIdentifier, keyIdentifier: keyIdentifier)
        try expectOnlyRequest(
            ExpectedRequest(method: "DELETE", path: "/owner/projects/\(projectIdentifier)/keys/\(keyIdentifier)", session: session, body: nil)
        )
    }

    @Test(arguments: KeyRequestKind.allCases, keyFailures)
    func mapsAKeyFailureAsTheOtherCalls(kind: KeyRequestKind, failure: (Int, String, OwnerAPIError)) async throws {
        let (status, body, expected) = failure
        let api = try api(answering: .response(status: status, body: body))
        await #expect(throws: expected) {
            try await kind.send(api: api, session: session, projectIdentifier: projectIdentifier)
        }
    }

    @Test(arguments: KeyRequestKind.allCases)
    func mapsAKeyCallOfflineToUnreachable(kind: KeyRequestKind) async throws {
        let api = try api(answering: .failure(URLError(.notConnectedToInternet)))
        await #expect(throws: OwnerAPIError.unreachable) {
            try await kind.send(api: api, session: session, projectIdentifier: projectIdentifier)
        }
    }
}
