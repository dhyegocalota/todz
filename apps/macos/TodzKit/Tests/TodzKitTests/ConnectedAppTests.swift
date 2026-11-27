import Foundation
import Testing
@testable import TodzKit

private let projectScopedIdentifier = "app-project"
private let ownerScopedIdentifier = "app-owner"
private let selectionScopedIdentifier = "app-selection"

@Suite struct ConnectedAppTests {
    @Test func decodesAProjectScopedAppWithItsLastUse() throws {
        let app = try OwnerFixtures.decoded(ConnectedApp.self, from: ConnectedAppFixtures.projectScopedJSON(identifier: projectScopedIdentifier))
        #expect(app == ConnectedAppFixtures.projectScoped(identifier: projectScopedIdentifier))
        #expect(app.id == projectScopedIdentifier)
    }

    @Test func decodesAnAccountScopedApp() throws {
        let app = try OwnerFixtures.decoded(ConnectedApp.self, from: ConnectedAppFixtures.ownerScopedJSON(identifier: ownerScopedIdentifier))
        #expect(app == ConnectedAppFixtures.ownerScoped(identifier: ownerScopedIdentifier))
    }

    @Test func decodesASelectionOfAWorkspaceAndAProjectInTheOrderTheServerSent() throws {
        let app = try OwnerFixtures.decoded(ConnectedApp.self, from: ConnectedAppFixtures.selectionScopedJSON(identifier: selectionScopedIdentifier))
        #expect(app == ConnectedAppFixtures.selectionScoped(identifier: selectionScopedIdentifier))
    }

    @Test func readsTheScopesAndNotTheLegacyScopeField() throws {
        let json = ConnectedAppFixtures.selectionScopedJSON(identifier: selectionScopedIdentifier).replacingOccurrences(of: "\"selection\"", with: "\"admin\"")
        let app = try OwnerFixtures.decoded(ConnectedApp.self, from: json)
        #expect(app.scopes.count == 2)
    }

    @Test func refusesAnAppWithoutItsLastUse() {
        let json = ConnectedAppFixtures.ownerScopedJSON(identifier: ownerScopedIdentifier)
            .replacingOccurrences(of: "\"last_used_at\":\(OwnerFixtures.createdAtMilliseconds)", with: "\"last_used_at\":null")
        #expect(throws: DecodingError.self) { try OwnerFixtures.decoded(ConnectedApp.self, from: json) }
    }

    @Test func refusesAProjectScopeWithoutItsWorkspace() {
        let json = ConnectedAppFixtures.projectScopedJSON(identifier: projectScopedIdentifier).replacingOccurrences(of: "\"workspace_name\":\"Acme\"", with: "\"workspace_name\":null")
        #expect(throws: DecodingError.self) { try OwnerFixtures.decoded(ConnectedApp.self, from: json) }
    }

    @Test func refusesAnUnknownScopeKind() {
        let json = ConnectedAppFixtures.ownerScopedJSON(identifier: ownerScopedIdentifier).replacingOccurrences(of: "\"account\"", with: "\"admin\"")
        #expect(throws: DecodingError.self) { try OwnerFixtures.decoded(ConnectedApp.self, from: json) }
    }

    @Test func aScopeSerializesAsItsKindAndIdentifiersOnly() throws {
        let scopes: [ConnectedScope] = [.account, .workspace(identifier: "w1", name: "Name"), .project(identifier: "p1", name: "Name", workspaceIdentifier: "w2", workspaceName: "Name")]
        let data = try OwnerCoding.encoder().encode(scopes)
        let sent = try #require(JSONSerialization.jsonObject(with: data) as? [NSDictionary])
        #expect(sent == [["kind": "account"], ["kind": "workspace", "workspace_id": "w1"], ["kind": "project", "project_id": "p1"]] as [NSDictionary])
    }
}
