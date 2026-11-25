import Foundation
import Testing
@testable import TodzKit

private let storageKey = "respectsFocus"

@Suite struct RespectFocusPreferenceTests {
    @Test func theStorageKeyIsRespectsFocus() {
        #expect(RespectFocusPreference.isOnStorageKey == storageKey)
    }

    @Test func aFreshDomainReadsOff() throws {
        let domain = try EmptyDomain()
        #expect(!RespectFocusPreference(defaults: domain.defaults, domainName: domain.name).isOn)
    }

    @Test func aStoredTrueReadsOn() throws {
        let domain = try EmptyDomain()
        domain.defaults.set(true, forKey: storageKey)
        #expect(RespectFocusPreference(defaults: domain.defaults, domainName: domain.name).isOn)
    }

    @Test func registeringTheDefaultsRegistersOff() throws {
        let domain = try EmptyDomain()
        RespectFocusPreference.registerDefaults(in: domain.defaults)
        #expect(domain.defaults.object(forKey: storageKey) as? Bool == false)
    }

    @Test func registeringNeverOverwritesTheOwnersChoice() throws {
        let domain = try EmptyDomain()
        domain.defaults.set(true, forKey: storageKey)
        RespectFocusPreference.registerDefaults(in: domain.defaults)
        #expect(RespectFocusPreference(defaults: domain.defaults, domainName: domain.name).isOn)
    }

    @Test func aValueOnlyInAnotherSearchedDomainIsIgnored() throws {
        let domain = try EmptyDomain()
        let searched = try EmptyDomain()
        defer { searched.defaults.removePersistentDomain(forName: searched.name) }
        searched.defaults.set(true, forKey: storageKey)
        domain.defaults.addSuite(named: searched.name)
        #expect(!RespectFocusPreference(defaults: domain.defaults, domainName: domain.name).isOn)
    }
}
