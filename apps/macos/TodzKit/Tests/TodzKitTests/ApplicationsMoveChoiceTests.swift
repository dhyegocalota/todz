import Testing
@testable import TodzKit

@Suite struct ApplicationsMoveChoiceTests {
    @Test func notNowIsTheFirstButtonSoItIsTheDefaultAction() {
        #expect(ApplicationsMoveChoice.alertButtonOrder.first == .notNow)
        #expect(ApplicationsMoveChoice.defaultChoice == .notNow)
    }

    @Test func movingIsTheSecondButtonAndNeverTheDefault() {
        #expect(ApplicationsMoveChoice.alertButtonOrder == [.notNow, .move])
        #expect(ApplicationsMoveChoice.defaultChoice != .move)
    }

    @Test func aButtonIndexMapsToItsChoice() {
        #expect(ApplicationsMoveChoice.of(alertButtonIndex: 0) == .notNow)
        #expect(ApplicationsMoveChoice.of(alertButtonIndex: 1) == .move)
    }

    @Test func anIndexOutsideTheButtonsIsNoChoice() {
        #expect(ApplicationsMoveChoice.of(alertButtonIndex: 2) == nil)
        #expect(ApplicationsMoveChoice.of(alertButtonIndex: -1) == nil)
    }
}
