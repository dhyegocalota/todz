import Testing
@testable import TodzKit

@MainActor @Suite struct ProactiveGateTests {
    @Test func aNewGateIsNotQuietAndShows() {
        let gate = ProactiveGate()
        #expect(!gate.isQuiet)
        #expect(gate.admit(.dayClose) == .show)
    }

    @Test func aQuietGateHoldsAndReleasesNothing() {
        let gate = ProactiveGate()
        gate.setQuiet(true)
        #expect(gate.isQuiet)
        #expect(gate.admit(.dayClose) == .held)
        #expect(gate.released == [])
    }

    @Test func quietEndingReleasesEachHeldKindOnceInTheOrderFirstHeld() {
        let gate = ProactiveGate()
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        #expect(gate.admit(.dayClose) == .held)
        #expect(gate.admit(.ribbon) == .held)
        gate.setQuiet(false)
        #expect(!gate.isQuiet)
        #expect(gate.released == [.dayClose, .ribbon])
    }

    @Test func aReleaseIsClaimedOnce() {
        let gate = ProactiveGate()
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        #expect(gate.admit(.ribbon) == .held)
        gate.setQuiet(false)
        #expect(gate.claimRelease(.dayClose))
        #expect(!gate.claimRelease(.dayClose))
        #expect(gate.released == [.ribbon])
        #expect(!gate.claimRelease(.morningGlance))
    }

    @Test func quietEndingTwiceReleasesNothingTheSecondTime() {
        let gate = ProactiveGate()
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        gate.setQuiet(false)
        gate.setQuiet(false)
        #expect(gate.released == [.dayClose])
    }

    @Test func quietTwiceThenNotQuietReleasesEachHeldKindOnce() {
        let gate = ProactiveGate()
        gate.setQuiet(true)
        #expect(gate.admit(.ribbon) == .held)
        gate.setQuiet(true)
        #expect(gate.admit(.ribbon) == .held)
        #expect(gate.admit(.morningGlance) == .held)
        gate.setQuiet(false)
        #expect(gate.released == [.ribbon, .morningGlance])
    }

    @Test func afterAReleaseTheGateShowsAgainAndAQuietThatHeldNothingAddsNothing() {
        let gate = ProactiveGate()
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        gate.setQuiet(false)
        #expect(gate.admit(.dayClose) == .show)
        gate.setQuiet(true)
        gate.setQuiet(false)
        #expect(gate.released == [.dayClose])
    }

    @Test func aKindHeldAgainBeforeItsReleaseIsClaimedIsReleasedOnce() {
        let gate = ProactiveGate()
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        gate.setQuiet(false)
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        gate.setQuiet(false)
        #expect(gate.released == [.dayClose])
    }

    @Test func theLaunchReadQuietsAFreshGate() {
        let gate = ProactiveGate()
        gate.applyLaunchRead(isQuiet: true)
        #expect(gate.isQuiet)
        #expect(gate.admit(.morningGlance) == .held)
    }

    @Test func aLaunchReadAfterAFocusChangeIsIgnored() {
        let gate = ProactiveGate()
        gate.setQuiet(false)
        gate.applyLaunchRead(isQuiet: true)
        #expect(!gate.isQuiet)
        #expect(gate.admit(.morningGlance) == .show)
    }
}
