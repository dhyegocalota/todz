import Foundation
import Testing
@testable import TodzKit

private let projectScopedIdentifier = "app-project"
private let ownerScopedIdentifier = "app-owner"

@Suite struct ConnectedAppTests {
    @Test func decodesAProjectScopedAppWithItsLastUse() throws {
        let app = try OwnerFixtures.decoded(ConnectedApp.self, from: ConnectedAppFixtures.projectScopedJSON(identifier: projectScopedIdentifier))
        #expect(app == ConnectedAppFixtures.projectScoped(identifier: projectScopedIdentifier))
        #expect(app.id == projectScopedIdentifier)
    }

    @Test func decodesAnOwnerScopedApp() throws {
        let app = try OwnerFixtures.decoded(ConnectedApp.self, from: ConnectedAppFixtures.ownerScopedJSON(identifier: ownerScopedIdentifier))
        #expect(app == ConnectedAppFixtures.ownerScoped(identifier: ownerScopedIdentifier))
    }

    @Test func refusesAnAppWithoutItsLastUse() {
        let json = ConnectedAppFixtures.ownerScopedJSON(identifier: ownerScopedIdentifier)
            .replacingOccurrences(of: "\"last_used_at\":\(OwnerFixtures.createdAtMilliseconds)", with: "\"last_used_at\":null")
        #expect(throws: DecodingError.self) { try OwnerFixtures.decoded(ConnectedApp.self, from: json) }
    }

    @Test func refusesAProjectScopedAppWithoutItsProject() {
        let json = ConnectedAppFixtures.ownerScopedJSON(identifier: ownerScopedIdentifier).replacingOccurrences(of: "\"owner\"", with: "\"project\"")
        #expect(throws: DecodingError.self) { try OwnerFixtures.decoded(ConnectedApp.self, from: json) }
    }

    @Test func refusesAnUnknownScope() {
        let json = ConnectedAppFixtures.ownerScopedJSON(identifier: ownerScopedIdentifier).replacingOccurrences(of: "\"owner\"", with: "\"admin\"")
        #expect(throws: DecodingError.self) { try OwnerFixtures.decoded(ConnectedApp.self, from: json) }
    }
}
