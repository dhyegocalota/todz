import Testing
@testable import TodzKit

private let ceiling = MotionTiming.ceilingMilliseconds
private let everyToken = MotionToken.allCases
private let crossfades = Array(repeating: MotionToken.crossfade, count: MotionToken.allCases.count)

private func isWellFormed(_ curve: MotionCurve) -> Bool {
    guard case let .spring(response, dampingFraction) = curve else { return true }
    return response > 0 && dampingFraction > 0 && dampingFraction <= 1
}

@Suite struct MotionTokenTests {
    @Test func theCeilingIs350Milliseconds() {
        #expect(MotionTiming.ceilingMilliseconds == 350)
    }

    @Test func everyTokenFitsTheCeiling() {
        #expect(everyToken.allSatisfy { $0.durationMilliseconds <= ceiling })
    }

    @Test func everySpringHasAPositiveResponseAndADampingUpToOne() {
        #expect(everyToken.allSatisfy { isWellFormed($0.curve) })
    }

    @Test func reduceMotionTurnsEveryTokenIntoACrossfade() {
        let reduced = everyToken.map { MotionRule.token($0, isReduceMotionOn: true) }
        #expect(reduced == crossfades)
    }

    @Test func withReduceMotionOffEveryTokenIsKept() {
        let kept = everyToken.map { MotionRule.token($0, isReduceMotionOn: false) }
        #expect(kept == everyToken)
    }

    @Test func theCrossfadeIsAnEaseNotASpring() {
        #expect(MotionToken.crossfade.curve == .ease)
    }
}
