import Testing
@testable import TodzKit

@Suite struct DocumentationAddressTests {
    @Test func theConnectGuideIsTheDocsPageOfTheCloud() {
        #expect(DocumentationAddress.connectAnAgent.absoluteString == "https://docs.todz.app/connect-an-agent")
    }
}
