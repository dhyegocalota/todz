import Testing
@testable import TodzKit

private let succeededStatus: Int32 = 0
private let existsStatus: Int32 = -9878
private let otherFailureStatus: Int32 = -50

@Suite struct GlobalChordAvailabilityTests {
    @Test func aSuccessfulRegistrationIsAvailable() {
        #expect(GlobalChordAvailability.registering(status: succeededStatus) == .available)
    }

    @Test func onlyTheExistsStatusMeansAnotherAppHoldsTheChord() {
        #expect(GlobalChordAvailability.registering(status: existsStatus) == .inUse)
    }

    @Test func anyOtherFailureIsAFailureOfOurOwn() {
        #expect(GlobalChordAvailability.registering(status: otherFailureStatus) == .failed)
    }
}

@Suite struct ChordModifiersGlobalTests {
    @Test func twoOrMoreOfControlOptionCommandCanBeGlobal() {
        #expect(([.control, .option] as ChordModifiers).canBeGlobal)
        #expect(([.control, .option, .command] as ChordModifiers).canBeGlobal)
        #expect(([.option, .command] as ChordModifiers).canBeGlobal)
    }

    @Test func oneOfThemAloneOrShiftWithOneCannotBeGlobal() {
        #expect(!([.control] as ChordModifiers).canBeGlobal)
        #expect(!([.command] as ChordModifiers).canBeGlobal)
        #expect(!([.control, .shift] as ChordModifiers).canBeGlobal)
        #expect(!([] as ChordModifiers).canBeGlobal)
    }
}
