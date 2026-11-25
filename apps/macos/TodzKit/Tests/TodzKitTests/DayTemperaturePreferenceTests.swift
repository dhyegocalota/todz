import Foundation
import Testing
@testable import TodzKit

private let storageKey = "showsDayTemperature"

@Suite struct DayTemperaturePreferenceTests {
    @Test func aFreshDomainReadsOff() throws {
        let domain = try EmptyDomain()
        #expect(!DayTemperaturePreference(defaults: domain.defaults, domainName: domain.name).isOn)
    }

    @Test func theStorageKeyIsShowsDayTemperature() {
        #expect(DayTemperaturePreference.isOnStorageKey == storageKey)
    }

    @Test func registeringTheDefaultsRegistersOff() throws {
        let domain = try EmptyDomain()
        DayTemperaturePreference.registerDefaults(in: domain.defaults)
        #expect(domain.defaults.object(forKey: storageKey) as? Bool == false)
    }

    @Test func registeringNeverOverwritesTheOwnersChoice() throws {
        let domain = try EmptyDomain()
        domain.defaults.set(true, forKey: storageKey)
        DayTemperaturePreference.registerDefaults(in: domain.defaults)
        #expect(DayTemperaturePreference(defaults: domain.defaults, domainName: domain.name).isOn)
    }

    @Test func aSetValueSurvivesANewPreferenceOverTheSameDomain() throws {
        let domain = try EmptyDomain()
        let first = DayTemperaturePreference(defaults: domain.defaults, domainName: domain.name)
        domain.defaults.set(true, forKey: storageKey)
        let second = DayTemperaturePreference(defaults: domain.defaults, domainName: domain.name)
        #expect(first.isOn)
        #expect(second.isOn)
    }

    @Test func aValueOnlyInAnotherSearchedDomainIsIgnored() throws {
        let domain = try EmptyDomain()
        let searched = try EmptyDomain()
        defer { searched.defaults.removePersistentDomain(forName: searched.name) }
        searched.defaults.set(true, forKey: storageKey)
        domain.defaults.addSuite(named: searched.name)
        #expect(!DayTemperaturePreference(defaults: domain.defaults, domainName: domain.name).isOn)
    }
}
