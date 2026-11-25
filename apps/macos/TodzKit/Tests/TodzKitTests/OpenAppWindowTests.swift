import Testing
@testable import TodzKit

private func counts(isVisible: Bool = false, isMiniaturized: Bool = false, canBecomeMain: Bool = false, isTitledAppWindow: Bool = false) -> Bool {
    OpenAppWindow.counts(isVisible: isVisible, isMiniaturized: isMiniaturized, canBecomeMain: canBecomeMain, isTitledAppWindow: isTitledAppWindow)
}

@Suite struct OpenAppWindowTests {
    @Test func aVisibleMainCapableWindowCounts() {
        #expect(counts(isVisible: true, canBecomeMain: true, isTitledAppWindow: true))
    }

    @Test func aMinimizedTitledWindowCounts() {
        #expect(counts(isMiniaturized: true, canBecomeMain: true, isTitledAppWindow: true))
    }

    @Test func aMinimizedTitledWindowThatSaysItCannotBecomeMainStillCounts() {
        #expect(counts(isMiniaturized: true, isTitledAppWindow: true))
    }

    @Test func aClosedWindowDoesNotCount() {
        #expect(!counts(canBecomeMain: true, isTitledAppWindow: true))
    }

    @Test func aVisiblePanelThatCannotBecomeMainDoesNotCount() {
        #expect(!counts(isVisible: true))
    }

    @Test func aMinimizedWindowThatIsNotATitledAppWindowDoesNotCount() {
        #expect(!counts(isMiniaturized: true, canBecomeMain: true))
    }
}
