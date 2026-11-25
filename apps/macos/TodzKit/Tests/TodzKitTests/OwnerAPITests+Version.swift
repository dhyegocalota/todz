import Foundation
import Testing
@testable import TodzKit

extension OwnerAPITests {
    @Test func anOwnerCallSendsTheAppVersion() async throws {
        _ = try await api(answering: .response(status: 200, body: "{\"workspaces\":[]}")).listWorkspaces(session: session)
        let sent = try #require(StubURLProtocol.recordedRequests().first)
        #expect(sent.appVersion == OwnerFixtures.appVersion)
    }
}
