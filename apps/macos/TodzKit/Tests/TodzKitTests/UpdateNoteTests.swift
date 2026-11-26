import Testing
@testable import TodzKit

@Suite struct UpdateNoteTests {
    @Test func aFirstLaunchShowsNoNote() {
        #expect(UpdateNote.pendingVersion(recorded: nil, current: "0.2.0") == nil)
    }

    @Test func aLaunchOfTheSameVersionShowsNoNote() {
        #expect(UpdateNote.pendingVersion(recorded: "0.2.0", current: "0.2.0") == nil)
    }

    @Test func aNewerVersionThanTheRecordedOneIsTheNote() {
        #expect(UpdateNote.pendingVersion(recorded: "0.2.0", current: "0.2.1") == "0.2.1")
    }

    @Test func aChangeOfVersionBackIsStillTheNote() {
        #expect(UpdateNote.pendingVersion(recorded: "0.2.1", current: "0.2.0") == "0.2.0")
    }
}
