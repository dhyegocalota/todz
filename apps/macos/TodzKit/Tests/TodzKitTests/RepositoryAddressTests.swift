import Foundation
import Testing
@testable import TodzKit

@Suite struct RepositoryAddressTests {
    @Test func theAddressIsTheTodzRepositoryOnGitHub() {
        #expect(RepositoryAddress.text == "https://github.com/dhyegocalota/todz")
    }

    @Test func theURLIsSecureAndHasTheTextAsItsAddress() {
        #expect(RepositoryAddress.url.scheme == "https")
        #expect(RepositoryAddress.url.host() == "github.com")
        #expect(RepositoryAddress.url.absoluteString == RepositoryAddress.text)
    }
}
