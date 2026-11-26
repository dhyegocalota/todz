import Foundation
import Testing
@testable import TodzKit

@Suite struct SelfHostAddressTests {
    @Test func theAddressIsTheSelfHostGuideOnTheDocsSite() {
        #expect(SelfHostAddress.text == "https://docs.todz.app/self-host")
    }

    @Test func theURLIsSecureAndHasTheTextAsItsAddress() {
        #expect(SelfHostAddress.url.scheme == "https")
        #expect(SelfHostAddress.url.host() == "docs.todz.app")
        #expect(SelfHostAddress.url.absoluteString == SelfHostAddress.text)
    }
}
