import Foundation
import Testing
@testable import TodzKit

private let shownDay = CalendarDate(year: 2026, month: 11, day: 25)

private struct GlanceDomain {
    let domain: EmptyDomain
    let preference: MorningGlancePreference

    init() throws {
        domain = try EmptyDomain()
        preference = MorningGlancePreference(defaults: domain.defaults, domainName: domain.name)
    }
}

@Suite struct MorningGlancePreferenceTests {
    @Test func theRegisteredDefaultReadsOnWithNoDayShown() throws {
        let glance = try GlanceDomain()
        MorningGlancePreference.registerDefaults(in: glance.domain.defaults)
        #expect(glance.preference.isOn)
        #expect(glance.preference.lastShownDay == nil)
    }

    @Test func aFreshDomainReadsOn() throws {
        let glance = try GlanceDomain()
        #expect(glance.preference.isOn)
    }

    @Test func registeringTheDefaultsRegistersOn() throws {
        let glance = try GlanceDomain()
        MorningGlancePreference.registerDefaults(in: glance.domain.defaults)
        #expect(glance.domain.defaults.object(forKey: MorningGlancePreference.isOnStorageKey) as? Bool == true)
    }

    @Test func aStoredFalseStaysOff() throws {
        let glance = try GlanceDomain()
        glance.domain.defaults.set(false, forKey: MorningGlancePreference.isOnStorageKey)
        MorningGlancePreference.registerDefaults(in: glance.domain.defaults)
        #expect(!glance.preference.isOn)
    }

    @Test func aNonBoolValueReadsAsTheDefault() throws {
        let glance = try GlanceDomain()
        glance.domain.defaults.set("no", forKey: MorningGlancePreference.isOnStorageKey)
        #expect(glance.preference.isOn)
    }

    @Test func registeringNeverOverwritesTheOwnersChoice() throws {
        let glance = try GlanceDomain()
        glance.domain.defaults.set(true, forKey: MorningGlancePreference.isOnStorageKey)
        MorningGlancePreference.registerDefaults(in: glance.domain.defaults)
        #expect(glance.preference.isOn)
    }

    @Test func aShownDayReadsBackFromTheAppsOwnDomain() throws {
        let glance = try GlanceDomain()
        glance.preference.markShown(day: shownDay)
        #expect(glance.preference.lastShownDay == shownDay)
        let stored = glance.domain.defaults.persistentDomain(forName: glance.domain.name)
        #expect(stored?[MorningGlancePreference.lastShownDayStorageKey] as? String == "2026-11-25")
    }

    @Test func aStoredDayThatIsNotACalendarDateReadsAsNeverShown() throws {
        let glance = try GlanceDomain()
        glance.domain.defaults.set("yesterday", forKey: MorningGlancePreference.lastShownDayStorageKey)
        #expect(glance.preference.lastShownDay == nil)
    }

    @Test func aValueOnlyInAnotherSearchedDomainIsIgnored() throws {
        let glance = try GlanceDomain()
        let searched = try EmptyDomain()
        defer { searched.defaults.removePersistentDomain(forName: searched.name) }
        searched.defaults.set(false, forKey: MorningGlancePreference.isOnStorageKey)
        searched.defaults.set("2026-11-25", forKey: MorningGlancePreference.lastShownDayStorageKey)
        glance.domain.defaults.addSuite(named: searched.name)
        #expect(!glance.domain.defaults.bool(forKey: MorningGlancePreference.isOnStorageKey))
        #expect(glance.preference.isOn)
        #expect(glance.preference.lastShownDay == nil)
    }
}
