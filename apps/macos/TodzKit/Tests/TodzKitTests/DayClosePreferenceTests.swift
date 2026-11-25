import Foundation
import Testing
@testable import TodzKit

private let storedMinutes = 7 * 60
private let closedDay = CalendarDate(year: 2026, month: 11, day: 25)
private let minutesOutsideADay = [-2880, 1440, Int.max]
private let minutesInsideADay = [0, 1439]

private struct DayCloseDomain {
    let domain: EmptyDomain
    let preference: DayClosePreference

    init() throws {
        domain = try EmptyDomain()
        preference = DayClosePreference(defaults: domain.defaults, domainName: domain.name)
    }
}

@Suite struct DayClosePreferenceTests {
    @Test func theRegisteredDefaultsReadOffAtSixInTheEvening() throws {
        let dayClose = try DayCloseDomain()
        DayClosePreference.registerDefaults(in: dayClose.domain.defaults)
        #expect(!dayClose.preference.isOn)
        #expect(dayClose.preference.minutesAfterMidnight == 1080)
        #expect(dayClose.preference.lastClosedDay == nil)
    }

    @Test func nothingStoredReadsAsSixInTheEvening() throws {
        let dayClose = try DayCloseDomain()
        #expect(dayClose.preference.minutesAfterMidnight == DayClosePreference.minutesAfterMidnightByDefault)
    }

    @Test func registeringNeverOverwritesTheOwnersChoice() throws {
        let dayClose = try DayCloseDomain()
        dayClose.domain.defaults.set(true, forKey: DayClosePreference.isOnStorageKey)
        dayClose.domain.defaults.set(storedMinutes, forKey: DayClosePreference.timeStorageKey)
        DayClosePreference.registerDefaults(in: dayClose.domain.defaults)
        #expect(dayClose.preference.isOn)
        #expect(dayClose.preference.minutesAfterMidnight == storedMinutes)
    }

    @Test func aClosedDayReadsBackFromTheAppsOwnDomain() throws {
        let dayClose = try DayCloseDomain()
        dayClose.preference.markClosed(day: closedDay)
        #expect(dayClose.preference.lastClosedDay == closedDay)
        let stored = dayClose.domain.defaults.persistentDomain(forName: dayClose.domain.name)
        #expect(stored?[DayClosePreference.lastClosedDayStorageKey] as? String == "2026-11-25")
    }

    @Test func aStoredDayThatIsNotACalendarDateReadsAsNeverClosed() throws {
        let dayClose = try DayCloseDomain()
        dayClose.domain.defaults.set("yesterday", forKey: DayClosePreference.lastClosedDayStorageKey)
        #expect(dayClose.preference.lastClosedDay == nil)
    }

    @Test func aValueOnlyInAnotherSearchedDomainIsIgnored() throws {
        let dayClose = try DayCloseDomain()
        let searched = try EmptyDomain()
        defer { searched.defaults.removePersistentDomain(forName: searched.name) }
        searched.defaults.set(true, forKey: DayClosePreference.isOnStorageKey)
        searched.defaults.set(storedMinutes, forKey: DayClosePreference.timeStorageKey)
        searched.defaults.set("2026-11-25", forKey: DayClosePreference.lastClosedDayStorageKey)
        dayClose.domain.defaults.addSuite(named: searched.name)
        #expect(dayClose.domain.defaults.bool(forKey: DayClosePreference.isOnStorageKey))
        #expect(!dayClose.preference.isOn)
        #expect(dayClose.preference.minutesAfterMidnight == DayClosePreference.minutesAfterMidnightByDefault)
        #expect(dayClose.preference.lastClosedDay == nil)
    }

    @Test func aStoredTimeThatIsNotANumberReadsAsOff() throws {
        let dayClose = try DayCloseDomain()
        dayClose.domain.defaults.set("evening", forKey: DayClosePreference.timeStorageKey)
        #expect(dayClose.preference.minutesAfterMidnight == nil)
    }

    @Test(arguments: minutesOutsideADay)
    func aStoredTimeOutsideADayReadsAsOff(minutes: Int) throws {
        let dayClose = try DayCloseDomain()
        dayClose.domain.defaults.set(minutes, forKey: DayClosePreference.timeStorageKey)
        #expect(dayClose.preference.minutesAfterMidnight == nil)
    }

    @Test(arguments: minutesInsideADay)
    func aStoredTimeInsideADayReadsAsSet(minutes: Int) throws {
        let dayClose = try DayCloseDomain()
        dayClose.domain.defaults.set(minutes, forKey: DayClosePreference.timeStorageKey)
        #expect(dayClose.preference.minutesAfterMidnight == minutes)
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
