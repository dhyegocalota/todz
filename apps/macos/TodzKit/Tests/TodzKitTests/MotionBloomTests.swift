import Testing
@testable import TodzKit

@Suite struct MotionBloomTests {
    @Test func aRestingBloomIsFullyVisible() {
        #expect(MotionBloom.opacity(isBloomed: true) == 1)
    }

    @Test func aDimmedBloomIsHidden() {
        #expect(MotionBloom.opacity(isBloomed: false) == 0)
    }

    @Test func aRestingBloomIsNotScaled() {
        #expect(MotionBloom.scale(isBloomed: true, isReduceMotionOn: false) == 1)
    }

    @Test func aDimmedBloomScalesDown() {
        #expect(MotionBloom.scale(isBloomed: false, isReduceMotionOn: false) == MotionBloom.dimmedScale)
    }

    @Test func reduceMotionNeverScales() {
        #expect(MotionBloom.scale(isBloomed: false, isReduceMotionOn: true) == 1)
    }
}
