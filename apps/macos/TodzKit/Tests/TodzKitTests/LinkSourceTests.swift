import Testing
@testable import TodzKit

@Suite struct LinkSourceTests {
    @Test func aWidgetLinkOpensTheWindowOnTheAddField() {
        #expect(LinkSource.widget.openingFocus == .addField)
    }

    @Test func theMorningGlanceOpensTheWindowOnTheListSoNoKeystrokeLandsInTheAddField() {
        #expect(LinkSource.morningGlance.openingFocus == .list)
    }
}
