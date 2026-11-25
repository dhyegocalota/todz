import Testing
@testable import TodzKit

@Suite struct OpenAppWindowTests {
    @Test func aVisibleMainCapableWindowCounts() {
        #expect(OpenAppWindow.counts(isVisible: true, isMiniaturized: false, canBecomeMain: true))
    }

    @Test func aMinimizedMainCapableWindowCounts() {
        #expect(OpenAppWindow.counts(isVisible: false, isMiniaturized: true, canBecomeMain: true))
    }

    @Test func aClosedWindowDoesNotCount() {
        #expect(!OpenAppWindow.counts(isVisible: false, isMiniaturized: false, canBecomeMain: true))
    }

    @Test func aVisiblePanelThatCannotBecomeMainDoesNotCount() {
        #expect(!OpenAppWindow.counts(isVisible: true, isMiniaturized: false, canBecomeMain: false))
    }

    @Test func aMinimizedPanelThatCannotBecomeMainDoesNotCount() {
        #expect(!OpenAppWindow.counts(isVisible: false, isMiniaturized: true, canBecomeMain: false))
    }
}
