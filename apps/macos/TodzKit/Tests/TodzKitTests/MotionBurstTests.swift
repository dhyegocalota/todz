import Testing
@testable import TodzKit

@Suite struct MotionBurstTests {
    @Test func aRestingBurstIsHidden() {
        #expect(MotionBurst.opacity(isBursting: false, isSpread: false) == 0)
    }

    @Test func aBurstStartsVisibleAtTheCentre() {
        #expect(MotionBurst.opacity(isBursting: true, isSpread: false) == 1)
    }

    @Test func aSpreadBurstHasFaded() {
        #expect(MotionBurst.opacity(isBursting: true, isSpread: true) == 0)
    }

    @Test func aBurstThatWasUndoneStaysHidden() {
        #expect(MotionBurst.opacity(isBursting: false, isSpread: true) == 0)
    }

    @Test func aBurstStartsAtTheCentreAndSpreadsOnce() {
        #expect(MotionBurst.spreadFraction(isSpread: false) == 0)
        #expect(MotionBurst.spreadFraction(isSpread: true) == 1)
    }
}
