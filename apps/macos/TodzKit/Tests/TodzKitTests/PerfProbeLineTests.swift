import Foundation
import Testing
@testable import TodzKit

@Suite struct PerfProbeLineTests {
    @Test func launchReadyIsOneLineWithMilliseconds() {
        #expect(PerfProbeLine.launchReady(milliseconds: 640).text == "launch-ready ms=640")
    }

    @Test func scrollIsOneLineWithTheFourCounts() {
        let line = PerfProbeLine.scroll(frames: 600, overBudget: 3, worstMilliseconds: 55, refreshMilliseconds: 17)
        #expect(line.text == "scroll frames=600 over-budget=3 worst-ms=55 refresh-ms=17")
    }

    @Test func footprintIsOneLineWithMegabytes() {
        #expect(PerfProbeLine.footprint(megabytes: 180).text == "footprint mb=180")
    }

    @Test func taskArrivedCarriesTheNumberAndTheEpochMilliseconds() {
        let line = PerfProbeLine.taskArrived(number: 7, atMilliseconds: 1_764_000_000_640)
        #expect(line.text == "task-arrived number=7 at-ms=1764000000640")
    }

    @Test func anArrivalAtAnInstantIsInEpochMilliseconds() {
        let line = PerfProbeLine.taskArrived(number: 7, at: Date(timeIntervalSince1970: 1_764_000_000.640))
        #expect(line == .taskArrived(number: 7, atMilliseconds: 1_764_000_000_640))
    }
}
