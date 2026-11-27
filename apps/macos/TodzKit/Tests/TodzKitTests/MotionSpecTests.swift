import Testing
@testable import TodzKit

private let ceiling = MotionTiming.ceilingMilliseconds
private let everyMoment = MotionMoment.allCases
private let staggerIndexes = Array(0 ... 12)
private let instantUnderReduceMotion: [MotionMoment] = [.reorder, .press, .hover, .focus]
private let crossfadedUnderReduceMotion: [MotionMoment] = [
    .listInsert, .listRemove, .complete, .uncomplete, .workspaceSwitch, .popoverOpen, .sheetPresent, .busySwap,
    .stageChange, .disclosure, .countChange, .ringFill, .upNextSwap, .banner, .skeletonToRows,
]
private let restingTokens: [MotionMoment: MotionToken] = [
    .listInsert: .bloom, .listRemove: .snap, .complete: .draw, .uncomplete: .draw, .reorder: .settle,
    .workspaceSwitch: .snap, .popoverOpen: .bloom, .sheetPresent: .snap, .busySwap: .snap, .stageChange: .settle,
    .disclosure: .settle, .countChange: .snap, .ringFill: .settle, .upNextSwap: .settle, .banner: .snap,
    .skeletonToRows: .crossfade, .press: .press, .hover: .snap, .focus: .snap,
]
private let restingTransforms: [MotionMoment: MotionTransform] = [
    .listInsert: .scale(0.96), .popoverOpen: .scale(0.96), .press: .scale(0.97),
    .upNextSwap: .offset(vertical: 8), .banner: .offset(vertical: 6),
]
private let lastStaggeredIndex = 5
private let stepMilliseconds = 12

private func spec(_ moment: MotionMoment, isReduceMotionOn: Bool, index: Int = 0) -> MotionSpec {
    MotionSpec.of(moment, isReduceMotionOn: isReduceMotionOn, index: index)
}

private func expectedTransform(_ moment: MotionMoment) -> MotionTransform {
    guard let transform = restingTransforms[moment] else { return .none }
    return transform
}

@Suite struct MotionSpecTests {
    @Test(arguments: [true, false]) func everyMomentFitsTheCeilingWithItsDelay(isReduceMotionOn: Bool) {
        let overruns = everyMoment.flatMap { moment in
            staggerIndexes.compactMap { index -> MotionMoment? in
                let resolved = spec(moment, isReduceMotionOn: isReduceMotionOn, index: index)
                guard let token = resolved.token else { return nil }
                return token.durationMilliseconds + resolved.delayMilliseconds > ceiling ? moment : nil
            }
        }
        #expect(overruns.isEmpty)
    }

    @Test func withReduceMotionOnNothingMovesScalesOrOffsets() {
        let moving = everyMoment.filter { spec($0, isReduceMotionOn: true).transform != .none }
        #expect(moving.isEmpty)
    }

    @Test func withReduceMotionOnTheInstantMomentsAreExactlyTheGeometryAndFeedbackOnes() {
        let instant = everyMoment.filter { spec($0, isReduceMotionOn: true).treatment == .instant }
        #expect(instant == instantUnderReduceMotion)
    }

    @Test func withReduceMotionOnTheOtherMomentsAreCrossfadesOfTheCrossfadeToken() {
        let crossfaded = everyMoment.filter { spec($0, isReduceMotionOn: true).treatment == .crossfade }
        let tokens = crossfaded.map { spec($0, isReduceMotionOn: true).token }
        #expect(crossfaded == crossfadedUnderReduceMotion)
        #expect(tokens == Array(repeating: MotionToken.crossfade, count: crossfaded.count))
    }

    @Test func withReduceMotionOnAnInstantMomentHasNoTokenAndNoDelay() {
        let instant = instantUnderReduceMotion.map { spec($0, isReduceMotionOn: true, index: lastStaggeredIndex) }
        #expect(instant.allSatisfy { $0.token == nil && $0.delayMilliseconds == 0 })
    }

    @Test func withReduceMotionOnTheWorkspaceSwitchIsOneCrossfadeWithoutStagger() {
        let delays = staggerIndexes.map { spec(.workspaceSwitch, isReduceMotionOn: true, index: $0).delayMilliseconds }
        #expect(delays == Array(repeating: 0, count: staggerIndexes.count))
    }

    @Test func withReduceMotionOffEveryMomentReturnsItsTokenOfTheTable() {
        let tokens = Dictionary(uniqueKeysWithValues: everyMoment.map { ($0, spec($0, isReduceMotionOn: false).token) })
        #expect(tokens == restingTokens.mapValues { Optional($0) })
    }

    @Test func withReduceMotionOffEveryMomentAnimatesExceptTheSkeletonCrossfade() {
        let animating = everyMoment.filter { spec($0, isReduceMotionOn: false).treatment == .animate }
        #expect(animating == everyMoment.filter { $0 != .skeletonToRows })
        #expect(spec(.skeletonToRows, isReduceMotionOn: false).treatment == .crossfade)
    }

    @Test func withReduceMotionOffEveryMomentCarriesItsTransform() {
        let transforms = Dictionary(uniqueKeysWithValues: everyMoment.map { ($0, spec($0, isReduceMotionOn: false).transform) })
        let expected = Dictionary(uniqueKeysWithValues: everyMoment.map { ($0, expectedTransform($0)) })
        #expect(transforms == expected)
    }

    @Test func withReduceMotionOffOnlyTheWorkspaceSwitchIsStaggered() {
        let delayed = everyMoment.filter { spec($0, isReduceMotionOn: false, index: lastStaggeredIndex).delayMilliseconds > 0 }
        #expect(delayed == [.workspaceSwitch])
    }

    @Test func withReduceMotionOffTheWorkspaceSwitchStartsEachRowLater() {
        let delays = (0 ... lastStaggeredIndex).map { spec(.workspaceSwitch, isReduceMotionOn: false, index: $0).delayMilliseconds }
        #expect(delays == [0, 12, 24, 36, 48, 60])
    }
}

@Suite struct MotionStaggerTests {
    @Test func theDelayIsTwelveMillisecondsPerRowUpToTheSixth() {
        let delays = (0 ... lastStaggeredIndex).map { MotionStagger.delayMilliseconds(index: $0, token: .snap) }
        #expect(delays == (0 ... lastStaggeredIndex).map { $0 * stepMilliseconds })
    }

    @Test func theDelayIsConstantAfterTheSixthRow() {
        let delays = (lastStaggeredIndex ... 40).map { MotionStagger.delayMilliseconds(index: $0, token: .snap) }
        #expect(Set(delays) == [lastStaggeredIndex * stepMilliseconds])
    }

    @Test func noTokenPlusTheMaximumDelayPassesTheCeiling() {
        let overruns = MotionToken.allCases.filter { token in
            token.durationMilliseconds + MotionStagger.delayMilliseconds(index: 40, token: token) > ceiling
        }
        #expect(overruns.isEmpty)
    }

    @Test func aTokenThatWouldPassTheCeilingWithTheDelayGetsNoStagger() {
        #expect(MotionStagger.delayMilliseconds(index: lastStaggeredIndex, token: .reveal) == 0)
    }
}

private let first = RowIdentity.task(TaskKey(projectIdentifier: "inbox", number: 1))
private let second = RowIdentity.task(TaskKey(projectIdentifier: "inbox", number: 2))
private let rowsOfAnotherList = (1 ... 9).map { RowIdentity.task(TaskKey(projectIdentifier: "work", number: $0)) }

private func shown(_ identities: Set<RowIdentity>?, in item: SidebarItem = .today) -> ShownRows {
    ShownRows(item: item, identities: identities)
}

@Suite struct RowArrivalTests {
    @Test func aDifferentListMarksTheFirstSixRowsInOrder() {
        let arriving = RowArrival.indices(known: shown([first]), current: shown(Set(rowsOfAnotherList), in: .upcoming), ordered: rowsOfAnotherList)
        #expect(arriving == Dictionary(uniqueKeysWithValues: rowsOfAnotherList.prefix(6).enumerated().map { ($1, $0) }))
    }

    @Test func theFirstRenderMarksTheFirstRows() {
        let arriving = RowArrival.indices(known: nil, current: shown([first, second]), ordered: [first, second])
        #expect(arriving == [first: 0, second: 1])
    }

    @Test func aListThatFinishedLoadingMarksTheFirstRows() {
        let arriving = RowArrival.indices(known: shown(nil), current: shown([first, second]), ordered: [first, second])
        #expect(arriving == [first: 0, second: 1])
    }

    @Test func anUnchangedSetMarksNone() {
        #expect(RowArrival.indices(known: shown([first, second]), current: shown([first, second]), ordered: [first, second]).isEmpty)
    }

    @Test func aRowAddedToTheSameListMarksNoneBecauseTheEntranceOwnsIt() {
        #expect(RowArrival.indices(known: shown([first]), current: shown([first, second]), ordered: [first, second]).isEmpty)
    }

    @Test func aScrollMarksNone() {
        let ordered = rowsOfAnotherList.reversed() as [RowIdentity]
        let known = shown(Set(rowsOfAnotherList), in: .upcoming)
        #expect(RowArrival.indices(known: known, current: known, ordered: ordered).isEmpty)
    }

    @Test func aListStillLoadingMarksNone() {
        #expect(RowArrival.indices(known: shown([first]), current: shown(nil, in: .upcoming), ordered: []).isEmpty)
    }
}

@Suite struct CountDirectionTests {
    @Test func aFallingCountCountsDown() {
        #expect(CountDirection.of(from: 5, to: 4) == .down)
        #expect(CountDirection.of(from: 5, to: 4).countsDown)
    }

    @Test func aRisingCountDoesNotCountDown() {
        #expect(CountDirection.of(from: 4, to: 5) == .up)
        #expect(!CountDirection.of(from: 4, to: 5).countsDown)
    }

    @Test func anUnchangedCountDoesNotCountDown() {
        #expect(CountDirection.of(from: 4, to: 4) == .unchanged)
        #expect(!CountDirection.of(from: 4, to: 4).countsDown)
    }
}
