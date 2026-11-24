import Foundation
import Testing
@testable import TodzKit

private let session = "s"
private let projectIdentifier = "p"
private let closedAddress = "http://127.0.0.1:9"

private func signals(_ address: String) throws -> SocketChangeSignals {
    SocketChangeSignals(baseURL: try #require(URL(string: address)))
}

@Suite struct SocketChangeSignalsTests {
    @Test func anHttpBaseOpensAPlainSocketOnTheProjectWithTheBearerSession() throws {
        let request = try signals("http://localhost:8787").socketRequest(session: session, projectIdentifier: projectIdentifier)
        #expect(request.url?.absoluteString == "ws://localhost:8787/owner/projects/p/socket")
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer s")
    }

    @Test func anHttpsBaseOpensASecureSocket() throws {
        let request = try signals("https://h").socketRequest(session: session, projectIdentifier: projectIdentifier)
        #expect(request.url?.absoluteString == "wss://h/owner/projects/p/socket")
    }

    @Test func aBaseThatIsNotHttpHasNoSocket() throws {
        #expect(throws: OwnerAPIError.unreachable) { try signals("ftp://h").socketRequest(session: session, projectIdentifier: projectIdentifier) }
    }

    @Test(.timeLimit(.minutes(1))) func aWatchOnAClosedPortFinishesUnreachable() async throws {
        let events = try signals(closedAddress).watch(session: session, projectIdentifier: projectIdentifier)
        await #expect(throws: OwnerAPIError.unreachable) {
            for try await _ in events {}
        }
    }
}
