import Testing
@testable import TodzKit

private func isInFront(
    isDayCloseDue: Bool = false,
    isClosingDay: Bool = false,
    isPopoverShown: Bool = false,
    isApplicationActive: Bool = false,
    hasVisibleMainCapableWindow: Bool = false
) -> Bool {
    MorningGlanceFront.isInFront(
        isDayCloseDue: isDayCloseDue,
        isClosingDay: isClosingDay,
        isPopoverShown: isPopoverShown,
        isApplicationActive: isApplicationActive,
        hasVisibleMainCapableWindow: hasVisibleMainCapableWindow
    )
}

@Suite struct MorningGlanceFrontTests {
    @Test func nothingIsInFrontWhenEveryInputIsFalse() {
        #expect(!isInFront())
    }

    @Test func aDueDayCloseIsInFront() {
        #expect(isInFront(isDayCloseDue: true))
    }

    @Test func aDayCloseOpeningIsInFront() {
        #expect(isInFront(isClosingDay: true))
    }

    @Test func aShownPopoverIsInFront() {
        #expect(isInFront(isPopoverShown: true))
    }

    @Test func anActiveApplicationAloneIsNotInFront() {
        #expect(!isInFront(isApplicationActive: true))
    }

    @Test func aVisibleWindowAloneIsNotInFront() {
        #expect(!isInFront(hasVisibleMainCapableWindow: true))
    }

    @Test func anActiveApplicationWithAVisibleWindowIsInFront() {
        #expect(isInFront(isApplicationActive: true, hasVisibleMainCapableWindow: true))
    }
}
