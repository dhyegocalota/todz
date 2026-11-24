import Testing
@testable import TodzKit

@Suite struct ReconnectDelayTests {
    @Test(arguments: [(1, 1), (2, 2), (3, 4), (4, 8), (5, 16), (6, 30), (7, 30), (100, 30), (Int.max, 30)])
    func theDelayDoublesFromOneSecondUpToThirty(attempt: Int, seconds: Int) {
        #expect(ReconnectDelay.after(attempt: attempt) == .seconds(seconds))
    }

    @Test(arguments: [0, -1, Int.min])
    func anAttemptBelowOneWaitsOneSecond(attempt: Int) {
        #expect(ReconnectDelay.after(attempt: attempt) == .seconds(1))
    }
}
