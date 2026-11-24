import Testing
@testable import TodzKit

private let openNumbers = [1, 2, 3, 4]

@Suite struct TaskPlacementRequestTests {
    @Test func movingTheSecondUpOnePutsItFirst() {
        #expect(TaskPlacementRequest.placement(openNumbers: openNumbers, moving: 2, direction: .up) == .first)
    }

    @Test func movingTheLastUpOnePutsItAfterTheSecond() {
        #expect(TaskPlacementRequest.placement(openNumbers: openNumbers, moving: 4, direction: .up) == .after(anchor: 2))
    }

    @Test func movingTheFirstDownOnePutsItAfterTheSecond() {
        #expect(TaskPlacementRequest.placement(openNumbers: openNumbers, moving: 1, direction: .down) == .after(anchor: 2))
    }

    @Test func draggingTheFirstPastTheEndPutsItAfterTheLast() {
        #expect(TaskPlacementRequest.placement(openNumbers: openNumbers, moving: 1, toOffset: 4) == .after(anchor: 4))
    }

    @Test func draggingTheFirstBetweenTheThirdAndTheLastPutsItAfterTheThird() {
        #expect(TaskPlacementRequest.placement(openNumbers: openNumbers, moving: 1, toOffset: 3) == .after(anchor: 3))
    }

    @Test func draggingTheLastToTheTopPutsItFirst() {
        #expect(TaskPlacementRequest.placement(openNumbers: openNumbers, moving: 4, toOffset: 0) == .first)
    }

    @Test(arguments: [1, 2])
    func draggingATaskOntoItselfMovesNothing(offset: Int) {
        #expect(TaskPlacementRequest.placement(openNumbers: openNumbers, moving: 2, toOffset: offset) == nil)
    }

    @Test func movingTheFirstUpOrTheLastDownMovesNothing() {
        #expect(TaskPlacementRequest.placement(openNumbers: openNumbers, moving: 1, direction: .up) == nil)
        #expect(TaskPlacementRequest.placement(openNumbers: openNumbers, moving: 4, direction: .down) == nil)
    }

    @Test func aTaskOutsideTheListMovesNothing() {
        #expect(TaskPlacementRequest.placement(openNumbers: openNumbers, moving: 9, toOffset: 0) == nil)
        #expect(TaskPlacementRequest.placement(openNumbers: [], moving: 1, direction: .down) == nil)
    }
}
