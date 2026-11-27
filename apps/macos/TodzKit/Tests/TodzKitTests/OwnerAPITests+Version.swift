import Foundation
import os
import Testing
@testable import TodzKit

extension OwnerAPITests {
    @Test func anOwnerCallSendsTheAppVersion() async throws {
        _ = try await api(answering: .response(status: 200, body: "{\"workspaces\":[]}")).listWorkspaces(session: session)
        let sent = try #require(StubURLProtocol.recordedRequests().first)
        #expect(sent.appVersion == OwnerFixtures.appVersion)
    }

    @Test func anOwnerCallSendsTheLanguageInEffectWhenItIsSent() async throws {
        let languages = OSAllocatedUnfairLock(initialState: AppLanguage.english)
        let baseURL = try #require(URL(string: "http://todz.test"))
        let transport = StubURLProtocol.session(answering: .response(status: 200, body: "{\"workspaces\":[]}"))
        let service = OwnerAPI(baseURL: baseURL, appVersion: OwnerFixtures.appVersion, language: { languages.withLock { $0 } }, transport: transport)
        _ = try await service.listWorkspaces(session: session)
        languages.withLock { $0 = .japanese }
        _ = try await service.listWorkspaces(session: session)
        #expect(StubURLProtocol.recordedRequests().map(\.acceptLanguage) == ["en", "ja"])
    }
}
