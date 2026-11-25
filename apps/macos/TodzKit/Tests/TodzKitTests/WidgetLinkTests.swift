import Foundation
import Testing
@testable import TodzKit

private let linksThatAreNotWidgetLinks = [
    "https://today",
    "todz://tomorrow",
    "todz://today/extra",
    "todz://task/acme-inbox",
    "todz://task/acme-inbox/three",
    "todz://task/acme-inbox/0",
    "todz://task/acme-inbox/-2",
    "todz://task/acme-inbox/3/extra",
    "todz:today",
]

private func link(_ text: String) throws -> WidgetLink? {
    WidgetLink(url: try #require(URL(string: text)), scheme: .release)
}

@Suite struct WidgetLinkTests {
    @Test func todayIsTheTodayLink() throws {
        #expect(try link("todz://today") == .today)
    }

    @Test func aTaskLinkNamesItsProjectAndNumber() throws {
        #expect(try link("todz://task/acme-inbox/3") == .task(TaskKey(projectIdentifier: "acme-inbox", number: 3)))
    }

    @Test func theLinksAreWrittenAsTheAppReadsThem() {
        #expect(WidgetLink.today.url(scheme: .release).absoluteString == "todz://today")
        #expect(WidgetLink.task(TaskKey(projectIdentifier: "acme-inbox", number: 3)).url(scheme: .release).absoluteString == "todz://task/acme-inbox/3")
    }

    @Test func aDebugLinkIsWrittenInTheDebugScheme() {
        #expect(WidgetLink.today.url(scheme: .debug).scheme == "todz-dev")
        #expect(WidgetLink.today.url(scheme: .debug).absoluteString == "todz-dev://today")
    }

    @Test func aDebugLinkIsReadByTheDebugAppAndNotByTheReleaseApp() throws {
        let url = try #require(URL(string: "todz-dev://today"))
        #expect(WidgetLink(url: url, scheme: .debug) == .today)
        #expect(WidgetLink(url: url, scheme: .release) == nil)
    }

    @Test func aReleaseLinkIsNotReadByTheDebugApp() throws {
        #expect(WidgetLink(url: try #require(URL(string: "todz://today")), scheme: .debug) == nil)
    }

    @Test func aProjectWithAnyCharacterComesBackWhole() {
        let key = TaskKey(projectIdentifier: "acme launch/ü?#", number: 12)
        #expect(WidgetLink(url: WidgetLink.task(key).url(scheme: .release), scheme: .release) == .task(key))
    }

    @Test(arguments: linksThatAreNotWidgetLinks)
    func anythingElseIsNoLink(text: String) throws {
        #expect(try link(text) == nil)
    }
}
