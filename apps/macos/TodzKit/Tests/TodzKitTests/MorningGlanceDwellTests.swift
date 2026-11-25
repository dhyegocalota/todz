import Foundation
import Testing
@testable import TodzKit

private let shownAt = Date(timeIntervalSince1970: 1_795_532_400)
private let fiveSeconds: TimeInterval = 5
private let thirtySeconds: TimeInterval = 30
private let halfASecond: TimeInterval = 0.5
private let fourTenthsOfASecond: TimeInterval = 0.4

private func after(_ seconds: TimeInterval) -> Date {
    shownAt.addingTimeInterval(seconds)
}

@Suite struct MorningGlanceDwellTests {
    @Test func aPanelNeverHoveredFadesFiveSecondsAfterItAppears() {
        #expect(MorningGlanceDwell(shownAt: shownAt).fadeStart == after(fiveSeconds))
    }

    @Test func aHoverHoldsThePanelUntilTheCap() {
        let dwell = MorningGlanceDwell(shownAt: shownAt).hovered(at: after(3))
        #expect(dwell.fadeStart == after(thirtySeconds))
    }

    @Test func theFiveSecondsRestartWhenThePointerLeaves() {
        let dwell = MorningGlanceDwell(shownAt: shownAt).hovered(at: after(3)).left(at: after(10))
        #expect(dwell.fadeStart == after(15))
    }

    @Test func aSecondHoverAndLeaveRestartTheFiveSecondsAgain() {
        let dwell = MorningGlanceDwell(shownAt: shownAt)
            .hovered(at: after(3))
            .left(at: after(10))
            .hovered(at: after(12))
            .left(at: after(20))
        #expect(dwell.fadeStart == after(25))
    }

    @Test func aHoverNeverLeftFadesAtTheCap() {
        let dwell = MorningGlanceDwell(shownAt: shownAt).hovered(at: after(1))
        #expect(dwell.fadeStart == after(thirtySeconds))
    }

    @Test func aLeaveNearTheCapFadesAtTheCapNotFiveSecondsLater() {
        let dwell = MorningGlanceDwell(shownAt: shownAt).hovered(at: after(1)).left(at: after(28))
        #expect(dwell.fadeStart == after(thirtySeconds))
    }

    @Test func theFadeTakesHalfASecondAndNothingWithReduceMotion() {
        #expect(MorningGlanceDwell.fadeDuration(reducesMotion: false) == halfASecond)
        #expect(MorningGlanceDwell.fadeDuration(reducesMotion: true) == 0)
    }

    @Test func thePointerIsIgnoredForTheFirstFourTenthsOfASecond() {
        #expect(MorningGlanceDwell.pointerGrace == fourTenthsOfASecond)
    }

    @Test func theShowAndTheCapAreFiveAndThirtySeconds() {
        #expect(MorningGlanceDwell.showDuration == fiveSeconds)
        #expect(MorningGlanceDwell.longestShow == thirtySeconds)
    }
}
