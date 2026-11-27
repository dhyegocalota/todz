import Foundation
import Testing
@testable import TodzKit

private let connectedAppIdentifier = UUID().uuidString.lowercased()

extension OwnerAPITests {
    @Test func listConnectedAppsUnwrapsTheApps() async throws {
        let apps = [
            ConnectedAppFixtures.projectScopedJSON(identifier: connectedAppIdentifier),
            ConnectedAppFixtures.ownerScopedJSON(identifier: "other-app"),
        ]
        let body = "{\"connected_apps\":[\(apps.joined(separator: ","))]}"
        let listed = try await api(answering: .response(status: 200, body: body)).listConnectedApps(session: session)
        try expectOnlyRequest(ExpectedRequest(method: "GET", path: "/owner/connected-apps", session: session, body: nil))
        #expect(listed == [ConnectedAppFixtures.projectScoped(identifier: connectedAppIdentifier), ConnectedAppFixtures.ownerScoped(identifier: "other-app")])
    }

    @Test func disconnectConnectedAppDeletesTheApp() async throws {
        try await api(answering: .response(status: 204, body: "")).disconnectConnectedApp(session: session, connectedAppIdentifier: connectedAppIdentifier)
        try expectOnlyRequest(ExpectedRequest(method: "DELETE", path: "/owner/connected-apps/\(connectedAppIdentifier)", session: session, body: nil))
    }

    @Test func disconnectingAnAbsentAppIsNotFound() async throws {
        let api = try api(answering: .response(status: 404, body: "{\"error\":\"not_found\"}"))
        await #expect(throws: OwnerAPIError.notFound) {
            try await api.disconnectConnectedApp(session: session, connectedAppIdentifier: connectedAppIdentifier)
        }
    }
}
