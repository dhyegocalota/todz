import Testing
@testable import TodzKit

@Suite struct LaunchIntervalTests {
    @Test func theIntervalIsTheMillisecondsFromTheProcessStartToTheFirstRows() {
        #expect(LaunchInterval.milliseconds(processStart: 1_000.000, firstRows: 1_000.640) == 640)
    }

    @Test func theIntervalIsRoundedToTheNearestMillisecond() {
        #expect(LaunchInterval.milliseconds(processStart: 1_000.0000, firstRows: 1_000.6404) == 640)
        #expect(LaunchInterval.milliseconds(processStart: 1_000.0000, firstRows: 1_000.6406) == 641)
    }
}
