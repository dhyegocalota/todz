import Testing
@testable import TodzKit

@MainActor private struct RollBench {
    let pauses = HeldPause()
    let coordinator: CountRollCoordinator

    init(isMotionReduced: Bool = false) {
        let pauses = pauses
        coordinator = CountRollCoordinator(pause: { try await pauses.pause($0) }, isMotionReduced: { isMotionReduced })
    }

    func playAll(frameCount: Int) async {
        await pauses.started(count: 1)
        for index in 1..<frameCount {
            pauses.release()
            await pauses.started(count: index + 1)
        }
        pauses.release()
        await coordinator.running?.value
    }
}

@MainActor @Suite struct CountRollCoordinatorTests {
    @Test func aChangeBetweenTwoCountsPlaysEveryFrameAndEnds() async {
        let bench = RollBench()
        let frames = CountRoll.frames(isMotionReduced: false)
        bench.coordinator.roll(from: "3", to: "4")
        await bench.pauses.started(count: 1)
        #expect(bench.coordinator.presentation == CountRollPresentation(outgoing: "3", incoming: "4", frame: frames[0]))
        await bench.playAll(frameCount: frames.count)
        #expect(bench.pauses.durations == frames.map(\.duration))
        #expect(bench.coordinator.presentation == nil)
    }

    @Test func aCountThatAppearsOrDisappearsOrStaysSwapsAtOnce() {
        let bench = RollBench()
        bench.coordinator.roll(from: nil, to: "4")
        bench.coordinator.roll(from: "4", to: nil)
        bench.coordinator.roll(from: "4", to: "4")
        #expect(bench.coordinator.presentation == nil)
        #expect(bench.pauses.durations.isEmpty)
    }

    @Test func aNewChangeReplacesTheRollInFlight() async {
        let bench = RollBench()
        bench.coordinator.roll(from: "3", to: "4")
        await bench.pauses.started(count: 1)
        bench.coordinator.roll(from: "4", to: "5")
        await bench.pauses.started(count: 2)
        let frames = CountRoll.frames(isMotionReduced: false)
        #expect(bench.coordinator.presentation == CountRollPresentation(outgoing: "4", incoming: "5", frame: frames[0]))
    }

    @Test func reduceMotionPlaysTheCrossfadeFrames() async {
        let bench = RollBench(isMotionReduced: true)
        let frames = CountRoll.frames(isMotionReduced: true)
        bench.coordinator.roll(from: "3", to: "4")
        await bench.pauses.started(count: 1)
        #expect(bench.coordinator.presentation?.frame == frames[0])
        await bench.playAll(frameCount: frames.count)
        #expect(bench.coordinator.presentation == nil)
    }

    @Test func endingStopsTheRollAtOnce() async {
        let bench = RollBench()
        bench.coordinator.roll(from: "3", to: "4")
        await bench.pauses.started(count: 1)
        bench.coordinator.end()
        #expect(bench.coordinator.presentation == nil)
    }
}
