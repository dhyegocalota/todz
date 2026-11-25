import Foundation
import Testing
@testable import TodzKit

private let unknownCadence = "weekly"

private struct RibbonDomain {
    let domain: EmptyDomain
    let preference: RibbonPreference

    init() throws {
        domain = try EmptyDomain()
        preference = RibbonPreference(defaults: domain.defaults, domainName: domain.name)
    }
}

@Suite struct RibbonPreferenceTests {
    @Test func theRegisteredDefaultsReadOffAndEveryHour() throws {
        let ribbon = try RibbonDomain()
        RibbonPreference.registerDefaults(in: ribbon.domain.defaults)
        #expect(!ribbon.preference.isOn)
        #expect(ribbon.preference.cadence == .hourly)
    }

    @Test func theStorageKeysAreTheOnesTheSettingsRowWrites() {
        #expect(RibbonPreference.isOnStorageKey == "showsMenuBarRibbon")
        #expect(RibbonPreference.cadenceStorageKey == "menuBarRibbonCadence")
    }

    @Test func aSetValueSurvivesANewPreferenceOverTheSameDomain() throws {
        let ribbon = try RibbonDomain()
        ribbon.domain.defaults.set(true, forKey: RibbonPreference.isOnStorageKey)
        ribbon.domain.defaults.set(RibbonCadence.dayClose.rawValue, forKey: RibbonPreference.cadenceStorageKey)
        let reopened = RibbonPreference(defaults: ribbon.domain.defaults, domainName: ribbon.domain.name)
        #expect(reopened.isOn)
        #expect(reopened.cadence == .dayClose)
    }

    @Test func aStoredCadenceTheAppDoesNotKnowReadsAsNone() throws {
        let ribbon = try RibbonDomain()
        ribbon.domain.defaults.set(unknownCadence, forKey: RibbonPreference.cadenceStorageKey)
        #expect(ribbon.preference.cadence == nil)
    }

    @Test func thePickerShowsEveryHourForAStoredCadenceTheAppDoesNotKnow() {
        #expect(RibbonPreference.pickerCadence(stored: unknownCadence) == .hourly)
    }

    @Test(arguments: RibbonCadence.allCases)
    func aStoredCadenceReadsBackAsItself(cadence: RibbonCadence) throws {
        let ribbon = try RibbonDomain()
        ribbon.domain.defaults.set(cadence.rawValue, forKey: RibbonPreference.cadenceStorageKey)
        #expect(ribbon.preference.cadence == cadence)
        #expect(RibbonPreference.pickerCadence(stored: cadence.rawValue) == cadence)
    }
}
