import Foundation
import Testing
@testable import TodzKit

private let frameCount = 600
private let longGaps: [Int: TimeInterval] = [100: 0.055, 250: 0.030, 400: 0.030]

private func timestamps(refreshRate: Double, gaps: [Int: TimeInterval]) -> [TimeInterval] {
    (0..<frameCount).reduce(into: [TimeInterval]()) { stamps, index in
        guard let last = stamps.last else {
            stamps.append(0)
            return
        }
        stamps.append(last + (gaps[index] ?? 1 / refreshRate))
    }
}

@Suite struct HitchCounterTests {
    @Test func countsTheGapsOverOneAndAHalfFramesAndKeepsTheWorst() {
        var counter = HitchCounter(refreshRate: 60)
        timestamps(refreshRate: 60, gaps: longGaps).forEach { counter.record(timestamp: $0) }
        #expect(counter.report == HitchReport(frames: 600, overBudget: 3, worstMilliseconds: 55, refreshMilliseconds: 17))
    }

    @Test func aSteadyScrollHasNoGapOverBudget() {
        var counter = HitchCounter(refreshRate: 60)
        timestamps(refreshRate: 60, gaps: [:]).forEach { counter.record(timestamp: $0) }
        #expect(counter.report.overBudget == 0)
        #expect(counter.report.worstMilliseconds == 17)
    }

    @Test func atOneHundredTwentyHertzTheThresholdIsTwelveAndAHalfMilliseconds() {
        var counter = HitchCounter(refreshRate: 120)
        timestamps(refreshRate: 120, gaps: [100: 0.013, 200: 0.012]).forEach { counter.record(timestamp: $0) }
        #expect(counter.report.overBudget == 1)
        #expect(counter.report.refreshMilliseconds == 8)
    }
}
