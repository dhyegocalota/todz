import Testing
@testable import TodzKit

@Suite struct MenuBarBadgeTests {
    @Test func aTurnedOffBadgeShowsNothing() {
        #expect(MenuBarBadge.text(openCount: 12, isEnabled: false) == nil)
    }

    @Test func zeroOpenTasksShowNothing() {
        #expect(MenuBarBadge.text(openCount: 0, isEnabled: true) == nil)
    }

    @Test func aCountThatIsNotLoadedShowsNothing() {
        #expect(MenuBarBadge.text(openCount: nil, isEnabled: true) == nil)
    }

    @Test func aNegativeCountShowsNothing() {
        #expect(MenuBarBadge.text(openCount: -1, isEnabled: true) == nil)
    }

    @Test func aCountUpToTheCapShowsTheNumber() {
        #expect(MenuBarBadge.text(openCount: 1, isEnabled: true) == "1")
        #expect(MenuBarBadge.text(openCount: 12, isEnabled: true) == "12")
        #expect(MenuBarBadge.text(openCount: 99, isEnabled: true) == "99")
    }

    @Test func aCountAboveTheCapShowsTheOverflow() {
        #expect(MenuBarBadge.text(openCount: 100, isEnabled: true) == "99+")
        #expect(MenuBarBadge.text(openCount: 134, isEnabled: true) == "99+")
    }
}
