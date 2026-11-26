import Foundation
import Testing
@testable import TodzKit

private let feedKey = "SUFeedURL"
private let releaseFeed = "https://todz.app/download/appcast.xml"

@Suite struct UpdateFeedTests {
    @Test func theKeyNamesTheFeed() {
        #expect(UpdateFeed(info: [feedKey: releaseFeed])?.url == URL(string: releaseFeed))
    }

    @Test func aBundleWithoutTheKeyHasNoFeed() {
        #expect(UpdateFeed(info: [:]) == nil)
    }

    @Test(arguments: ["", "http://todz.app/download/appcast.xml", "todz.app/download/appcast.xml", "ftp://todz.app/appcast.xml"])
    func aKeyThatIsNotAnHTTPSAddressHasNoFeed(text: String) {
        #expect(UpdateFeed(info: [feedKey: text]) == nil)
    }

    @Test func aKeyThatIsNotTextHasNoFeed() {
        #expect(UpdateFeed(info: [feedKey: 1]) == nil)
    }
}
