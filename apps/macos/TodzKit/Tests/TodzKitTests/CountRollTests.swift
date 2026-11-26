import Testing
@testable import TodzKit

private let ceilingMilliseconds = Double(MotionTiming.ceilingMilliseconds)
private let frameDuration = Duration.seconds(1) / RibbonMotion.framesPerSecond
private let rolled = CountRoll.frames(isMotionReduced: false)
private let crossfaded = CountRoll.frames(isMotionReduced: true)

private func milliseconds(_ frames: [CountRollFrame]) -> Double {
    frames.reduce(.zero) { $0 + $1.duration } / .milliseconds(1)
}

private func frameCount(of token: MotionToken) -> Int {
    token.durationMilliseconds * RibbonMotion.framesPerSecond / Int(millisecondsPerSecond)
}

@Suite struct CountRollTests {
    @Test func theRollFitsTheMotionCeiling() {
        #expect(milliseconds(rolled) <= ceilingMilliseconds)
        #expect(milliseconds(crossfaded) <= ceilingMilliseconds)
    }

    @Test func theRollPlaysAtTheRibbonFrameRate() {
        #expect(rolled.allSatisfy { $0.duration == frameDuration })
        #expect(crossfaded.allSatisfy { $0.duration == frameDuration })
    }

    @Test func theRollTakesTheBloomTokenAndTheCrossfadeTakesTheCrossfadeToken() {
        #expect(rolled.count == frameCount(of: .bloom))
        #expect(crossfaded.count == frameCount(of: .crossfade))
    }

    @Test func reduceMotionIsDecidedByTheMotionRule() {
        #expect(crossfaded.count == frameCount(of: MotionRule.token(.bloom, isReduceMotionOn: true)))
    }

    @Test func theLastFrameShowsOnlyTheIncomingCountAtRest() {
        let expected = CountRollFrame(outgoingRise: CountRoll.rise, outgoingOpacity: 0, incomingRise: 0, incomingOpacity: 1, duration: frameDuration)
        #expect(rolled.last == expected)
    }

    @Test func theOutgoingCountRisesAwayAndFadesWhileTheIncomingCountRisesInAndAppears() {
        #expect(rolled.map(\.outgoingRise) == rolled.map(\.outgoingRise).sorted())
        #expect(rolled.map(\.outgoingOpacity) == rolled.map(\.outgoingOpacity).sorted(by: >))
        #expect(rolled.map(\.incomingRise) == rolled.map(\.incomingRise).sorted())
        #expect(rolled.map(\.incomingOpacity) == rolled.map(\.incomingOpacity).sorted())
        #expect(rolled.first.map { $0.incomingRise < 0 && $0.outgoingOpacity > 0 } == true)
    }

    @Test func reduceMotionNeverMovesTheCount() {
        #expect(crossfaded.allSatisfy { $0.outgoingRise == 0 && $0.incomingRise == 0 })
    }

    @Test func reduceMotionCrossfadesTheTwoCounts() {
        #expect(crossfaded.map(\.incomingOpacity) == crossfaded.map(\.incomingOpacity).sorted())
        #expect(crossfaded.map(\.outgoingOpacity) == crossfaded.map { 1 - $0.incomingOpacity })
        #expect(crossfaded.last?.incomingOpacity == 1)
    }

    @Test func aCountRollsOnlyBetweenTwoDifferentCounts() {
        #expect(CountRoll.isRolling(from: "3", to: "4"))
        #expect(CountRoll.isRolling(from: "99+", to: "99"))
        #expect(!CountRoll.isRolling(from: "3", to: "3"))
        #expect(!CountRoll.isRolling(from: nil, to: "3"))
        #expect(!CountRoll.isRolling(from: "3", to: nil))
        #expect(!CountRoll.isRolling(from: nil, to: nil))
    }
}
