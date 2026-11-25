import Testing
@testable import TodzKit

private let windowWidth = RibbonMotion.windowWidth
private let stripMaxWidth = RibbonMotion.stripMaxWidth
private let framesPerSecond = RibbonMotion.framesPerSecond
private let scrollSpeed = RibbonMotion.scrollSpeed
private let fittingWidth = windowWidth - 30
private let overflow = 100.0
private let overflowingWidth = windowWidth + overflow
private let cappedWidth = stripMaxWidth * 2
private let longestOverflow = stripMaxWidth - windowWidth
private let unfoldFrames = RibbonMotion.foldFrameCount
private let scrollFramesOfTheOverflow = Int((overflow * Double(framesPerSecond) / scrollSpeed).rounded(.up))
private let widestWidth = Int(stripMaxWidth * 5)
private let longestTimeline = RibbonMotion.foldDuration * 2 + RibbonMotion.edgeHold * 2 + .seconds(longestOverflow / scrollSpeed)
private let mostFrames = unfoldFrames * 2 + 2 + Int((longestOverflow * Double(framesPerSecond) / scrollSpeed).rounded(.up))
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
        #expect(total(Array(frames.prefix(unfoldFrames))) == RibbonMotion.foldDuration)
        #expect(frames[unfoldFrames] == RibbonFrame(reveal: 1, offset: 0, duration: RibbonMotion.dwell))
        #expect(frames.suffix(unfoldFrames).map(\.reveal) == folding)
        #expect(total(Array(frames.suffix(unfoldFrames))) == RibbonMotion.foldDuration)
        #expect(frames.allSatisfy { $0.offset == 0 })
    }

    @Test func textThatOverflowsHoldsScrollsOnceHoldsAndFolds() {
        let frames = timeline(overflowingWidth)
        let scrollStart = unfoldFrames + 1
        let scrollEnd = scrollStart + scrollFramesOfTheOverflow
        let scrolling = Array(frames[scrollStart..<scrollEnd])
        #expect(frames.count == scrollEnd + 1 + unfoldFrames)
        #expect(frames[unfoldFrames] == RibbonFrame(reveal: 1, offset: 0, duration: RibbonMotion.edgeHold))
        #expect(scrolling.map(\.offset) == (1...scrollFramesOfTheOverflow).map { Double($0) * scrollSpeed / Double(framesPerSecond) })
        #expect(scrolling.allSatisfy { $0.reveal == 1 && $0.duration == frameDuration })
        #expect(scrolling.last?.offset == overflow)
        #expect(frames[scrollEnd] == RibbonFrame(reveal: 1, offset: overflow, duration: RibbonMotion.edgeHold))
        #expect(frames.suffix(unfoldFrames).map(\.reveal) == folding)
    }

    @Test func aLongLineScrollsOnlyToTheEndOfTheStripCap() {
        let frames = timeline(cappedWidth)
        #expect(frames.map(\.offset).max() == longestOverflow)
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
        #expect(frames == [RibbonFrame(reveal: 1, offset: 0, duration: RibbonMotion.dwell)])
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
