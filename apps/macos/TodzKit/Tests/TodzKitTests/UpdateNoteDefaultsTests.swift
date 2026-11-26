import Foundation
import Testing
@testable import TodzKit

@Suite struct UpdateNoteDefaultsTests {
    @Test func aFirstLaunchRecordsTheVersionAndShowsNoNote() throws {
        let defaults = try emptyDefaults()
        #expect(UpdateNote.recordLaunch(ofVersion: "0.2.0", defaults: defaults) == nil)
        #expect(defaults.string(forKey: UpdateNote.lastLaunchedVersionStorageKey) == "0.2.0")
    }

    @Test func aTappedNoteDoesNotComeBackOnRelaunch() throws {
        let defaults = try emptyDefaults()
        _ = UpdateNote.recordLaunch(ofVersion: "0.2.0", defaults: defaults)
        #expect(UpdateNote.recordLaunch(ofVersion: "0.2.1", defaults: defaults) == "0.2.1")
        UpdateNote.clearPendingVersion(defaults: defaults)
        #expect(UpdateNote.recordLaunch(ofVersion: "0.2.1", defaults: defaults) == nil)
    }

    @Test func anUntappedNoteShowsTheNewestVersionAcrossTwoUpdates() throws {
        let defaults = try emptyDefaults()
        _ = UpdateNote.recordLaunch(ofVersion: "0.2.0", defaults: defaults)
        _ = UpdateNote.recordLaunch(ofVersion: "0.2.1", defaults: defaults)
        #expect(UpdateNote.recordLaunch(ofVersion: "0.2.2", defaults: defaults) == "0.2.2")
    }

    @Test func anUntappedNoteStaysOnAnUnchangedRelaunch() throws {
        let defaults = try emptyDefaults()
        _ = UpdateNote.recordLaunch(ofVersion: "0.2.0", defaults: defaults)
        _ = UpdateNote.recordLaunch(ofVersion: "0.2.1", defaults: defaults)
        #expect(UpdateNote.recordLaunch(ofVersion: "0.2.1", defaults: defaults) == "0.2.1")
    }
}
