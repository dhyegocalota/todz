import Testing
@testable import TodzKit

private let rest = TitleFlightPoint(x: 300, y: 20)
private let source = TitleFlightPoint(x: 24, y: 140)

@Suite struct TitleFlightTests {
    @Test func theTitleStartsAtTheSidebarRowAndRestsAtTheHeader() {
        let start = TitleFlight.start(source: source, rest: rest, isMotionReduced: false)
        #expect(start == TitleFlightStart(offsetX: -276, offsetY: 120, opacity: 0))
    }

    @Test func aTitleWithoutAMeasuredRowDoesNotFly() {
        let start = TitleFlight.start(source: nil, rest: rest, isMotionReduced: false)
        #expect(start == TitleFlightStart(offsetX: 0, offsetY: 0, opacity: 1))
    }

    @Test func reduceMotionCrossfadesInPlace() {
        let start = TitleFlight.start(source: source, rest: rest, isMotionReduced: true)
        #expect(start == TitleFlightStart(offsetX: 0, offsetY: 0, opacity: 0))
    }

    @Test func theFlightUsesTheSettleTokenAndTheMotionRuleDecidesReduceMotion() {
        #expect(TitleFlight.token(isMotionReduced: false) == .settle)
        #expect(TitleFlight.token(isMotionReduced: true) == MotionRule.token(.settle, isReduceMotionOn: true))
    }
}
