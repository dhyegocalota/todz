import Foundation
import Testing
@testable import TodzKit

private let appVersionHeader = "Todz-App-Version"

@Suite struct OwnerRequestTests {
    @Test func aTransportRequestCarriesTheAppVersion() throws {
        let baseURL = try #require(URL(string: "http://todz.test"))
        let request = try OwnerRequest(method: .get, path: "/owner", session: nil).transportRequest(baseURL: baseURL, appVersion: OwnerFixtures.appVersion)
        #expect(request.value(forHTTPHeaderField: appVersionHeader) == OwnerFixtures.appVersion)
    }

    @Test func theSocketUpgradeSendsTheAppVersion() throws {
        let baseURL = try #require(URL(string: "http://localhost:8787"))
        let request = try SocketChangeSignals(baseURL: baseURL, appVersion: OwnerFixtures.appVersion).socketRequest(session: "s", projectIdentifier: "p")
        #expect(request.value(forHTTPHeaderField: appVersionHeader) == OwnerFixtures.appVersion)
    }
}
