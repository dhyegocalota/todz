import Testing
@testable import TodzKit

private let fittingWidth = 150.0
private let overflowingWidth = 280.0
private let cappedWidth = 900.0
private let unfoldFrames = 8
private let scrollFramesOfTheOverflow = 75
private let framesPerSecond = 30
private let scrollSpeed = 40.0
private let widestWidth = 2000
private let longestTimeline = Duration.seconds(9.5)
private let mostFrames = 285
private let unfolding = (1...unfoldFrames).map { Double($0) / Double(unfoldFrames) }
private let folding = (0..<unfoldFrames).reversed().map { Double($0) / Double(unfoldFrames) }
private let frameDuration = Duration.seconds(1) / framesPerSecond

private func timeline(_ textWidth: Double) -> [RibbonFrame] {
    RibbonMotion.timeline(textWidth: textWidth, isMotionReduced: false)
}

private func total(_ frames: [RibbonFrame]) -> Duration {
    frames.reduce(.zero) { $0 + $1.duration }
}

@Suite struct RibbonMotionTests {
    @Test func textThatFitsUnfoldsHoldsFiveSecondsAndFolds() {
        let frames = timeline(fittingWidth)
        #expect(frames.count == unfoldFrames + 1 + unfoldFrames)
        #expect(frames.prefix(unfoldFrames).map(\.reveal) == unfolding)
        #expect(total(Array(frames.prefix(unfoldFrames))) == .seconds(0.25))
        #expect(frames[unfoldFrames] == RibbonFrame(reveal: 1, offset: 0, duration: .seconds(5)))
        #expect(frames.suffix(unfoldFrames).map(\.reveal) == folding)
        #expect(total(Array(frames.suffix(unfoldFrames))) == .seconds(0.25))
        #expect(frames.allSatisfy { $0.offset == 0 })
    }

    @Test func textThatOverflowsHoldsScrollsOnceHoldsAndFolds() {
        let frames = timeline(overflowingWidth)
        let scrollStart = unfoldFrames + 1
        let scrollEnd = scrollStart + scrollFramesOfTheOverflow
        let scrolling = Array(frames[scrollStart..<scrollEnd])
        #expect(frames.count == scrollEnd + 1 + unfoldFrames)
        #expect(frames[unfoldFrames] == RibbonFrame(reveal: 1, offset: 0, duration: .seconds(1.5)))
        #expect(scrolling.map(\.offset) == (1...scrollFramesOfTheOverflow).map { Double($0) * scrollSpeed / Double(framesPerSecond) })
        #expect(scrolling.allSatisfy { $0.reveal == 1 && $0.duration == frameDuration })
        #expect(scrolling.last?.offset == 100)
        #expect(frames[scrollEnd] == RibbonFrame(reveal: 1, offset: 100, duration: .seconds(1.5)))
        #expect(frames.suffix(unfoldFrames).map(\.reveal) == folding)
    }

    @Test func aLongLineScrollsOnlyToTheEndOfTheStripCap() {
        let frames = timeline(cappedWidth)
        #expect(frames.map(\.offset).max() == 240)
        #expect(timeline(cappedWidth * 2) == frames)
    }

    @Test func noWidthOutlastsNineAndAHalfSecondsOrTwoHundredEightyFiveFrames() {
        let timelines = (0...widestWidth).map { timeline(Double($0)) }
        #expect(timelines.allSatisfy { total($0) <= longestTimeline })
        #expect(timelines.allSatisfy { $0.count <= mostFrames })
    }

    @Test(arguments: [0.0, fittingWidth, overflowingWidth, cappedWidth])
    func reducedMotionIsOneFrameOfFiveSeconds(textWidth: Double) {
        let frames = RibbonMotion.timeline(textWidth: textWidth, isMotionReduced: true)
        #expect(frames == [RibbonFrame(reveal: 1, offset: 0, duration: .seconds(5))])
    }

    @Test(arguments: [0.0, -1.0, -500.0])
    func noWidthIsTheFittingTimelineWithNoScroll(textWidth: Double) {
        #expect(timeline(textWidth) == timeline(fittingWidth))
    }

    @Test func noFrameHasAZeroOrNegativeDuration() {
        let timelines = (0...widestWidth).map { timeline(Double($0)) }
        #expect(timelines.allSatisfy { $0.allSatisfy { $0.duration > .zero } })
    }
}
