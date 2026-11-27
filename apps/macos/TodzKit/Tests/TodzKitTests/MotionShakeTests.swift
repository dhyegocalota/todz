import Testing
@testable import TodzKit

@Suite struct MotionShakeTests {
    @Test func theShakeStartsAndEndsAtRest() {
        #expect(MotionShake.offset(progress: 0, isReduceMotionOn: false) == 0)
        #expect(abs(MotionShake.offset(progress: 1, isReduceMotionOn: false)) < 1e-9)
    }

    @Test func theShakeNeverTravelsPastItsLimit() {
        let offsets = stride(from: 0.0, through: 1.0, by: 0.01).map { MotionShake.offset(progress: $0, isReduceMotionOn: false) }
        #expect(offsets.allSatisfy { abs($0) <= MotionShake.travel })
        #expect(offsets.contains { $0 > MotionShake.travel / 2 })
        #expect(offsets.contains { $0 < -MotionShake.travel / 2 })
    }

    @Test func reduceMotionNeverMovesTheField() {
        let offsets = stride(from: 0.0, through: 1.0, by: 0.05).map { MotionShake.offset(progress: $0, isReduceMotionOn: true) }
        #expect(offsets.allSatisfy { $0 == 0 })
    }
}
