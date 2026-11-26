import Foundation
import Testing
@testable import TodzKit

private let controlOption: ChordModifiers = [.control, .option]

@Suite struct GlobalChordPlanTests {
    @Test func noGlobalDefaultIsAnInAppChord() {
        let plan = GlobalChordPlan(chords: GlobalWorkspaceChords(), isHeldBySystem: { _ in false })
        let registered = Set(plan.registrations.values)
        #expect(registered.isDisjoint(with: WorkspaceAction.inAppChords))
    }

    @Test func everyGlobalDefaultIsRegisteredWhenNoSystemChordHoldsIt() {
        let plan = GlobalChordPlan(chords: GlobalWorkspaceChords(), isHeldBySystem: { _ in false })
        #expect(plan.registrations.count == WorkspaceShortcuts.numbers.count)
        #expect(plan.heldBySystem.isEmpty)
    }

    @Test func aChordTheSystemHoldsIsInUseAndNotRegistered() throws {
        let chords = GlobalWorkspaceChords()
        let held = try #require(chords.chord(for: .number(3)))
        let plan = GlobalChordPlan(chords: chords, isHeldBySystem: { $0 == held })
        #expect(plan.heldBySystem == [.number(3)])
        #expect(plan.registrations[.number(3)] == nil)
        #expect(plan.registrations.count == WorkspaceShortcuts.numbers.count - 1)
    }

    @Test func aRebindToAFreeChordIsRegistered() throws {
        let chord = KeyChord(keyCode: 0, key: "a", modifiers: controlOption)
        let chords = try GlobalWorkspaceChords().rebinding(.number(1), to: chord).get()
        let plan = GlobalChordPlan(chords: chords, isHeldBySystem: { _ in false })
        #expect(plan.registrations[.number(1)] == chord)
    }
}
