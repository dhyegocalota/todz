import Foundation
import Testing
@testable import TodzKit

private let shownDay = CalendarDate(year: 2026, month: 11, day: 25)

@Suite struct MorningGlancePreferenceTests {
    @Test func theRegisteredDefaultReadsOffWithNoDayShown() throws {
        let defaults = try emptyDefaults()
        MorningGlancePreference.registerDefaults(in: defaults)
        #expect(!MorningGlancePreference.isOn(in: defaults))
        #expect(MorningGlancePreference.lastShownDay(in: defaults) == nil)
    }

    @Test func registeringNeverOverwritesTheOwnersChoice() throws {
        let defaults = try emptyDefaults()
        defaults.set(true, forKey: MorningGlancePreference.isOnStorageKey)
        MorningGlancePreference.registerDefaults(in: defaults)
        #expect(MorningGlancePreference.isOn(in: defaults))
    }

    @Test func aShownDayReadsBack() throws {
        let defaults = try emptyDefaults()
        MorningGlancePreference.markShown(day: shownDay, in: defaults)
        #expect(MorningGlancePreference.lastShownDay(in: defaults) == shownDay)
        #expect(defaults.string(forKey: MorningGlancePreference.lastShownDayStorageKey) == "2026-11-25")
    }

    @Test func aStoredDayThatIsNotACalendarDateReadsAsNeverShown() throws {
        let defaults = try emptyDefaults()
        defaults.set("yesterday", forKey: MorningGlancePreference.lastShownDayStorageKey)
        #expect(MorningGlancePreference.lastShownDay(in: defaults) == nil)
    }
}
