import Testing
@testable import TodzKit

private let controlFlag = 1 << 18
private let optionFlag = 1 << 19
private let shiftFlag = 1 << 17
private let commandFlag = 1 << 20

private func entry(keyCode: Int, flags: Int, enabled: Bool = true) -> [String: Any] {
    ["enabled": enabled, "value": ["parameters": [65535, keyCode, flags], "type": "standard"]]
}

@Suite struct SymbolicHotKeysTests {
    private let controlThree = KeyChord(keyCode: 20, key: "3", modifiers: [.control])

    @Test func anEnabledSystemEntryWithTheSameKeyAndModifiersHoldsTheChord() {
        let entries = ["131": entry(keyCode: 20, flags: controlFlag)]
        #expect(SymbolicHotKeys.holds(controlThree, in: entries))
    }

    @Test func aDisabledSystemEntryDoesNotHoldTheChord() {
        let entries = ["131": entry(keyCode: 20, flags: controlFlag, enabled: false)]
        #expect(!SymbolicHotKeys.holds(controlThree, in: entries))
    }

    @Test func aSystemEntryWithAnotherModifierDoesNotHoldTheChord() {
        let entries = ["131": entry(keyCode: 20, flags: controlFlag | shiftFlag)]
        #expect(!SymbolicHotKeys.holds(controlThree, in: entries))
    }

    @Test func aSystemEntryForAnotherKeyDoesNotHoldTheChord() {
        let entries = ["132": entry(keyCode: 21, flags: controlFlag)]
        #expect(!SymbolicHotKeys.holds(controlThree, in: entries))
    }

    @Test func systemModifierFlagsMapToControlOptionShiftAndCommand() {
        let chord = KeyChord(keyCode: 0, key: "a", modifiers: [.control, .option, .shift, .command])
        let entries = ["1": entry(keyCode: 0, flags: controlFlag | optionFlag | shiftFlag | commandFlag)]
        #expect(SymbolicHotKeys.holds(chord, in: entries))
    }

    @Test func noEntriesHoldNothing() {
        #expect(!SymbolicHotKeys.holds(controlThree, in: [:]))
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
