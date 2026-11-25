import Foundation
import Testing
@testable import TodzKit

private let storedMinutes = 7 * 60
private let closedDay = CalendarDate(year: 2026, month: 11, day: 25)
private let minutesOutsideADay = [-2880, 1440, Int.max]
private let minutesInsideADay = [0, 1439]

@Suite struct DayClosePreferenceTests {
    @Test func theRegisteredDefaultsReadOffAtSixInTheEvening() throws {
        let defaults = try emptyDefaults()
        DayClosePreference.registerDefaults(in: defaults)
        #expect(!DayClosePreference.isOn(in: defaults))
        #expect(DayClosePreference.minutesAfterMidnight(in: defaults) == 1080)
        #expect(DayClosePreference.lastClosedDay(in: defaults) == nil)
    }

    @Test func registeringNeverOverwritesTheOwnersChoice() throws {
        let defaults = try emptyDefaults()
        defaults.set(true, forKey: DayClosePreference.isOnStorageKey)
        defaults.set(storedMinutes, forKey: DayClosePreference.timeStorageKey)
        DayClosePreference.registerDefaults(in: defaults)
        #expect(DayClosePreference.isOn(in: defaults))
        #expect(DayClosePreference.minutesAfterMidnight(in: defaults) == storedMinutes)
    }

    @Test func aClosedDayReadsBack() throws {
        let defaults = try emptyDefaults()
        DayClosePreference.markClosed(day: closedDay, in: defaults)
        #expect(DayClosePreference.lastClosedDay(in: defaults) == closedDay)
        #expect(defaults.string(forKey: DayClosePreference.lastClosedDayStorageKey) == "2026-11-25")
    }

    @Test func aStoredDayThatIsNotACalendarDateReadsAsNeverClosed() throws {
        let defaults = try emptyDefaults()
        defaults.set("yesterday", forKey: DayClosePreference.lastClosedDayStorageKey)
        #expect(DayClosePreference.lastClosedDay(in: defaults) == nil)
    }

    @Test func theOwnersChoicesAndTheClosedDayReadBackFromTheAppsOwnDomain() throws {
        let domain = try EmptyDomain()
        let preference = DayClosePreference(defaults: domain.defaults, domainName: domain.name)
        #expect(!preference.isOn)
        #expect(preference.minutesAfterMidnight == DayClosePreference.minutesAfterMidnightByDefault)
        #expect(preference.lastClosedDay == nil)
        domain.defaults.set(true, forKey: DayClosePreference.isOnStorageKey)
        domain.defaults.set(storedMinutes, forKey: DayClosePreference.timeStorageKey)
        preference.markClosed(day: closedDay)
        #expect(preference.isOn)
        #expect(preference.minutesAfterMidnight == storedMinutes)
        #expect(preference.lastClosedDay == closedDay)
        #expect(domain.defaults.persistentDomain(forName: domain.name)?[DayClosePreference.lastClosedDayStorageKey] as? String == "2026-11-25")
    }

    @Test func aValueOnlyInAnotherSearchedDomainIsIgnored() throws {
        let domain = try EmptyDomain()
        let searched = try EmptyDomain()
        defer { searched.defaults.removePersistentDomain(forName: searched.name) }
        searched.defaults.set(true, forKey: DayClosePreference.isOnStorageKey)
        searched.defaults.set(storedMinutes, forKey: DayClosePreference.timeStorageKey)
        searched.defaults.set("2026-11-25", forKey: DayClosePreference.lastClosedDayStorageKey)
        domain.defaults.addSuite(named: searched.name)
        #expect(domain.defaults.bool(forKey: DayClosePreference.isOnStorageKey))
        let preference = DayClosePreference(defaults: domain.defaults, domainName: domain.name)
        #expect(!preference.isOn)
        #expect(preference.minutesAfterMidnight == DayClosePreference.minutesAfterMidnightByDefault)
        #expect(preference.lastClosedDay == nil)
    }

    @Test func aStoredTimeThatIsNotANumberReadsAsOff() throws {
        let domain = try EmptyDomain()
        domain.defaults.set("evening", forKey: DayClosePreference.timeStorageKey)
        #expect(DayClosePreference(defaults: domain.defaults, domainName: domain.name).minutesAfterMidnight == nil)
    }

    @Test(arguments: minutesOutsideADay)
    func aStoredTimeOutsideADayReadsAsOff(minutes: Int) throws {
        let defaults = try emptyDefaults()
        defaults.set(minutes, forKey: DayClosePreference.timeStorageKey)
        #expect(DayClosePreference.minutesAfterMidnight(in: defaults) == nil)
    }

    @Test(arguments: minutesInsideADay)
    func aStoredTimeInsideADayReadsAsSet(minutes: Int) throws {
        let defaults = try emptyDefaults()
        defaults.set(minutes, forKey: DayClosePreference.timeStorageKey)
        #expect(DayClosePreference.minutesAfterMidnight(in: defaults) == minutes)
    }

    @Test(arguments: minutesOutsideADay)
    func thePickerShowsTheDefaultTimeForAStoredTimeOutsideADay(minutes: Int) {
        #expect(DayClosePreference.pickerMinutes(stored: minutes) == DayClosePreference.minutesAfterMidnightByDefault)
    }

    @Test(arguments: minutesInsideADay)
    func thePickerShowsAStoredTimeInsideADay(minutes: Int) {
        #expect(DayClosePreference.pickerMinutes(stored: minutes) == minutes)
    }
}
