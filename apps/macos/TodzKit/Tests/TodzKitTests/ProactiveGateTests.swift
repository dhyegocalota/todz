import Testing
@testable import TodzKit

@MainActor @Suite struct ProactiveGateTests {
    @Test func aNewGateIsNotQuietAndShows() {
        let gate = ProactiveGate(respectsFocus: true)
        #expect(!gate.isQuiet)
        #expect(gate.admit(.dayClose) == .show)
    }

    @Test func aQuietGateHoldsAndReleasesNothing() {
        let gate = ProactiveGate(respectsFocus: true)
        gate.setQuiet(true)
        #expect(gate.isQuiet)
        #expect(gate.admit(.dayClose) == .held)
        #expect(gate.released == [])
    }

    @Test func quietEndingReleasesEachHeldKindOnceInTheOrderFirstHeld() {
        let gate = ProactiveGate(respectsFocus: true)
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        #expect(gate.admit(.dayClose) == .held)
        #expect(gate.admit(.ribbon) == .held)
        gate.setQuiet(false)
        #expect(!gate.isQuiet)
        #expect(gate.released == [.dayClose, .ribbon])
    }

    @Test func aReleaseIsClaimedOnce() {
        let gate = ProactiveGate(respectsFocus: true)
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
        let gate = ProactiveGate(respectsFocus: true)
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        gate.setQuiet(false)
        gate.setQuiet(false)
        #expect(gate.released == [.dayClose])
    }

    @Test func quietTwiceThenNotQuietReleasesEachHeldKindOnce() {
        let gate = ProactiveGate(respectsFocus: true)
        gate.setQuiet(true)
        #expect(gate.admit(.ribbon) == .held)
        gate.setQuiet(true)
        #expect(gate.admit(.ribbon) == .held)
        #expect(gate.admit(.morningGlance) == .held)
        gate.setQuiet(false)
        #expect(gate.released == [.ribbon, .morningGlance])
    }

    @Test func afterAReleaseTheGateShowsAgainAndAQuietThatHeldNothingAddsNothing() {
        let gate = ProactiveGate(respectsFocus: true)
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        gate.setQuiet(false)
        #expect(gate.admit(.dayClose) == .show)
        gate.setQuiet(true)
        gate.setQuiet(false)
        #expect(gate.released == [.dayClose])
    }

    @Test func aKindHeldAgainBeforeItsReleaseIsClaimedIsReleasedOnce() {
        let gate = ProactiveGate(respectsFocus: true)
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        gate.setQuiet(false)
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        gate.setQuiet(false)
        #expect(gate.released == [.dayClose])
    }

    @Test func aReleaseCannotBeClaimedWhileANewFocusIsOn() {
        let gate = ProactiveGate(respectsFocus: true)
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        gate.setQuiet(false)
        gate.setQuiet(true)
        #expect(!gate.claimRelease(.dayClose))
        #expect(gate.released == [.dayClose])
    }

    @Test func aReleaseHeldAgainDuringANewFocusIsHandedBackOnceWhenItEnds() {
        let gate = ProactiveGate(respectsFocus: true)
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        gate.setQuiet(false)
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        #expect(!gate.claimRelease(.dayClose))
        gate.setQuiet(false)
        #expect(gate.released == [.dayClose])
        #expect(gate.claimRelease(.dayClose))
        #expect(!gate.claimRelease(.dayClose))
    }

    @Test func theLaunchReadQuietsAFreshGate() {
        let gate = ProactiveGate(respectsFocus: true)
        gate.applyLaunchRead(isQuiet: true)
        #expect(gate.isQuiet)
        #expect(gate.admit(.morningGlance) == .held)
    }

    @Test func aLaunchReadAfterAFocusChangeIsIgnored() {
        let gate = ProactiveGate(respectsFocus: true)
        gate.setQuiet(false)
        gate.applyLaunchRead(isQuiet: true)
        #expect(!gate.isQuiet)
        #expect(gate.admit(.morningGlance) == .show)
    }

    @Test func aLateLaunchReadAfterTheTimeoutQuietedTheGateReleasesWhatItHeld() {
        let gate = ProactiveGate(respectsFocus: true)
        gate.applyLaunchRead(isQuiet: true)
        #expect(gate.admit(.dayClose) == .held)
        gate.applyLaunchRead(isQuiet: false)
        #expect(!gate.isQuiet)
        #expect(gate.released == [.dayClose])
    }

    @Test func aPerformThatArrivesAfterTheTimeoutWinsOverTheLateLaunchRead() {
        let gate = ProactiveGate(respectsFocus: true)
        gate.applyLaunchRead(isQuiet: true)
        gate.setQuiet(true)
        gate.applyLaunchRead(isQuiet: false)
        #expect(gate.isQuiet)
    }

    @Test func turningRespectFocusOffWhileHeldReleasesEachHeldKindOnce() {
        let gate = ProactiveGate(respectsFocus: true)
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        #expect(gate.admit(.dayClose) == .held)
        #expect(gate.admit(.ribbon) == .held)
        gate.setRespectsFocus(false)
        #expect(!gate.isQuiet)
        #expect(gate.released == [.dayClose, .ribbon])
    }

    @Test func withRespectFocusOffAQuietFilterShows() {
        let gate = ProactiveGate(respectsFocus: false)
        gate.setQuiet(true)
        #expect(!gate.isQuiet)
        #expect(gate.admit(.dayClose) == .show)
    }

    @Test func withRespectFocusOnAQuietFilterHolds() {
        let gate = ProactiveGate(respectsFocus: true)
        gate.setQuiet(true)
        #expect(gate.isQuiet)
        #expect(gate.admit(.dayClose) == .held)
    }

    @Test func turningRespectFocusOnDuringAQuietFilterHoldsFromThenOn() {
        let gate = ProactiveGate(respectsFocus: false)
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .show)
        gate.setRespectsFocus(true)
        #expect(gate.isQuiet)
        #expect(gate.admit(.dayClose) == .held)
    }

    @Test func aPerformWhileOffIsRememberedAndAppliesWhenTheSwitchTurnsOn() {
        let gate = ProactiveGate(respectsFocus: false)
        gate.setQuiet(true)
        gate.applyLaunchRead(isQuiet: false)
        gate.setRespectsFocus(true)
        #expect(gate.isQuiet)
    }

    @Test func switchOffWhileHeldThenPerformFalseReleasesNothingTwice() {
        let gate = ProactiveGate(respectsFocus: true)
        gate.setQuiet(true)
        #expect(gate.admit(.dayClose) == .held)
        gate.setRespectsFocus(false)
        #expect(gate.claimRelease(.dayClose))
        gate.setQuiet(false)
        #expect(gate.released == [])
    }
}
