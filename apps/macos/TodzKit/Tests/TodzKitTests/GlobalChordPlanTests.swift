import Foundation
import Testing
@testable import TodzKit

private let controlOption: ChordModifiers = [.control, .option]

@Suite struct GlobalChordPlanTests {
    @Test func everyGlobalDefaultIsPlanned() {
        let plan = GlobalChordPlan(chords: GlobalWorkspaceChords())
        #expect(plan.registrations.count == WorkspaceShortcuts.numbers.count)
    }

    @Test func noPlannedChordIsAnInAppChord() {
        let plan = GlobalChordPlan(chords: GlobalWorkspaceChords())
        #expect(Set(plan.registrations.values).isDisjoint(with: WorkspaceAction.inAppChords))
    }

    @Test func anInAppChordStoredAsAGlobalChordIsNeverPlanned() throws {
        let inAppChord = try #require(WorkspaceAction.number(1).inAppChord)
        let plan = GlobalChordPlan(chords: GlobalWorkspaceChords(overrides: [.number(1): inAppChord]))
        #expect(plan.registrations[.number(1)] == nil)
        #expect(plan.registrations.count == WorkspaceShortcuts.numbers.count - 1)
    }

    @Test func aRebindToAFreeChordIsPlanned() throws {
        let chord = KeyChord(keyCode: 0, key: "a", modifiers: controlOption)
        let chords = try GlobalWorkspaceChords().rebinding(.number(1), to: chord).get()
        let plan = GlobalChordPlan(chords: chords)
        #expect(plan.registrations[.number(1)] == chord)
    }
}
