import Foundation
import Testing
@testable import TodzKit

private let appVersionHeader = "Todz-App-Version"
private let acceptLanguageHeader = "Accept-Language"

@Suite struct OwnerRequestTests {
    @Test func aTransportRequestCarriesTheAppVersion() throws {
        let baseURL = try #require(URL(string: "http://todz.test"))
        let request = try OwnerRequest(method: .get, path: "/owner", session: nil).transportRequest(baseURL: baseURL, appVersion: OwnerFixtures.appVersion, language: .portugueseBrazil)
        #expect(request.value(forHTTPHeaderField: appVersionHeader) == OwnerFixtures.appVersion)
    }

    @Test(arguments: AppLanguage.allCases)
    func aTransportRequestCarriesTheEffectiveLanguage(language: AppLanguage) throws {
        let baseURL = try #require(URL(string: "http://todz.test"))
        let request = try OwnerRequest(method: .get, path: "/owner", session: nil).transportRequest(baseURL: baseURL, appVersion: OwnerFixtures.appVersion, language: language)
        #expect(request.value(forHTTPHeaderField: acceptLanguageHeader) == language.rawValue)
    }

    @Test func theSocketUpgradeSendsTheEffectiveLanguage() throws {
        let baseURL = try #require(URL(string: "http://localhost:8787"))
        let request = try SocketChangeSignals(baseURL: baseURL, appVersion: OwnerFixtures.appVersion, language: { .korean }).socketRequest(session: "s", projectIdentifier: "p")
        #expect(request.value(forHTTPHeaderField: acceptLanguageHeader) == "ko")
    }

    @Test func theSocketUpgradeSendsTheAppVersion() throws {
        let baseURL = try #require(URL(string: "http://localhost:8787"))
        let request = try SocketChangeSignals(baseURL: baseURL, appVersion: OwnerFixtures.appVersion, language: OwnerFixtures.language).socketRequest(session: "s", projectIdentifier: "p")
        #expect(request.value(forHTTPHeaderField: appVersionHeader) == OwnerFixtures.appVersion)
    }
}
