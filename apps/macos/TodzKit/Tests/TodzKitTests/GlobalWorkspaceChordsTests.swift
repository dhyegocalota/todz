import Foundation
import Testing
@testable import TodzKit

private let controlOnly: ChordModifiers = [.control]
private let controlOption: ChordModifiers = [.control, .option]
private let controlCommand: ChordModifiers = [.control, .command]
private let controlOptionCommand: ChordModifiers = [.control, .option, .command]
private let oneModifierChord = KeyChord(keyCode: 0, key: "a", modifiers: controlOnly)

@Suite struct GlobalWorkspaceChordsTests {
    @Test func controlOptionCommandAndTheDigitIsTheGlobalDefaultOfEachNumber() throws {
        let chords = GlobalWorkspaceChords()
        let first = try #require(chords.chord(for: .number(1)))
        let ninth = try #require(chords.chord(for: .number(9)))
        #expect(first.modifiers == controlOptionCommand)
        #expect(first.label == "⌃⌥⌘1")
        #expect(ninth.label == "⌃⌥⌘9")
    }

    @Test func everyNumberHasADistinctGlobalDefaultKeyCode() {
        let codes = WorkspaceShortcuts.numbers.compactMap { GlobalWorkspaceChords().chord(for: .number($0))?.keyCode }
        #expect(Set(codes).count == WorkspaceShortcuts.numbers.count)
    }

    @Test func previousAndNextHaveNoGlobalChord() {
        #expect(GlobalWorkspaceChords().chord(for: .previous) == nil)
        #expect(GlobalWorkspaceChords().chord(for: .next) == nil)
    }

    @Test func aNumberBeyondTheNinthHasNoChord() {
        #expect(GlobalWorkspaceChords().chord(for: .number(10)) == nil)
    }

    @Test func theInAppChordsAreControlForTheNumbersAndControlCommandForTheSteps() throws {
        let ninth = try #require(WorkspaceAction.number(9).inAppChord)
        let previous = try #require(WorkspaceAction.previous.inAppChord)
        let next = try #require(WorkspaceAction.next.inAppChord)
        #expect(ninth.label == "⌃9")
        #expect(ninth.modifiers == controlOnly)
        #expect(previous.label == "⌃⌘[")
        #expect(previous.modifiers == controlCommand)
        #expect(next.label == "⌃⌘]")
    }

    @Test func noInAppChordIsAGlobalDefault() {
        let globalDefaults = WorkspaceShortcuts.numbers.compactMap { WorkspaceAction.number($0).globalDefaultChord }
        #expect(WorkspaceAction.inAppChords.allSatisfy { !globalDefaults.contains($0) })
        #expect(WorkspaceAction.inAppChords.count == WorkspaceAction.all.count)
    }

    @Test func aChordNamesItsAction() throws {
        let chords = GlobalWorkspaceChords()
        let chord = try #require(chords.chord(for: .number(3)))
        #expect(chords.action(for: chord) == .number(3))
    }

    @Test func aRebindReplacesTheChordOfThatActionOnly() throws {
        let chord = KeyChord(keyCode: 0, key: "a", modifiers: controlOption)
        let rebound = try GlobalWorkspaceChords().rebinding(.number(2), to: chord).get()
        #expect(rebound.chord(for: .number(2)) == chord)
        #expect(rebound.chord(for: .number(1)) == GlobalWorkspaceChords().chord(for: .number(1)))
        #expect(rebound.action(for: chord) == .number(2))
    }

    @Test func aChordAnotherNumberHoldsIsRefused() throws {
        let chords = GlobalWorkspaceChords()
        let held = try #require(chords.chord(for: .number(2)))
        #expect(chords.rebinding(.number(1), to: held) == .failure(.taken(by: .number(2))))
    }

    @Test func rebindingToTheChordItAlreadyHoldsIsAccepted() throws {
        let chords = GlobalWorkspaceChords()
        let held = try #require(chords.chord(for: .number(2)))
        #expect(chords.rebinding(.number(2), to: held) == .success(chords))
    }

    @Test func aChordWithOneModifierIsRefusedSoItCannotTakeACommonKey() {
        #expect(GlobalWorkspaceChords().rebinding(.number(1), to: oneModifierChord) == .failure(.needsTwoModifiers))
    }

    @Test func anInAppChordIsRefusedAsAGlobalChord() {
        let previousInApp = KeyChord(keyCode: 33, key: "[", modifiers: controlCommand)
        #expect(GlobalWorkspaceChords().rebinding(.number(1), to: previousInApp) == .failure(.inAppChord))
    }

    @Test func previousAndNextCannotBeRebound() {
        let chord = KeyChord(keyCode: 0, key: "a", modifiers: controlOption)
        #expect(GlobalWorkspaceChords().rebinding(.previous, to: chord) == .failure(.notGlobal))
    }

    @Test func aStorageNameReadsBackToItsAction() {
        #expect(WorkspaceAction.all.compactMap { WorkspaceAction(storageName: $0.storageName) } == WorkspaceAction.all)
        #expect(WorkspaceAction(storageName: "number10") == nil)
        #expect(WorkspaceAction(storageName: "sideways") == nil)
    }
}
