import Testing
@testable import TodzKit

private let glyphWidth = 18.0
private let glyphInkRight = glyphWidth - MenuBarLayout.glyphTrailingInset

@Suite struct MenuBarLayoutTests {
    @Test func theGlyphArtworkEndsTwoAndAHalfPointsBeforeItsBox() {
        #expect(MenuBarLayout.glyphTrailingInset == 2.5)
    }

    @Test func theCountStartsOneAndAHalfPointsAfterTheGlyphInk() {
        #expect(MenuBarLayout.countGap == 1.5)
        #expect(MenuBarLayout.textOrigin(glyphWidth: glyphWidth) - glyphInkRight == MenuBarLayout.countGap)
    }

    @Test func theCountTucksIntoTheGlyphMargin() {
        #expect(MenuBarLayout.glyphSpacing == -1)
        #expect(MenuBarLayout.textOrigin(glyphWidth: glyphWidth) == 17)
    }

    @Test func theCountRisesHalfAPointToSitOnTheCheckmarkBaseline() {
        #expect(MenuBarLayout.countRise == 0.5)
    }
}
