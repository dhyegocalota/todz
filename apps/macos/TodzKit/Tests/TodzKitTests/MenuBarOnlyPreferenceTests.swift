import Foundation
import Testing
@testable import TodzKit

private let storageKey = "keepsInMenuBarWhenClosed"

@Suite struct MenuBarOnlyPreferenceTests {
    @Test func aFreshDomainReadsOn() throws {
        let domain = try EmptyDomain()
        #expect(MenuBarOnlyPreference(defaults: domain.defaults, domainName: domain.name).isOn)
    }

    @Test func aStoredOffReadsOff() throws {
        let domain = try EmptyDomain()
        domain.defaults.set(false, forKey: storageKey)
        #expect(!MenuBarOnlyPreference(defaults: domain.defaults, domainName: domain.name).isOn)
    }

    @Test func theStorageKeyIsKeepsInMenuBarWhenClosed() {
        #expect(MenuBarOnlyPreference.isOnStorageKey == storageKey)
    }

    @Test func registeringTheDefaultsRegistersOn() throws {
        let domain = try EmptyDomain()
        MenuBarOnlyPreference.registerDefaults(in: domain.defaults)
        #expect(domain.defaults.object(forKey: storageKey) as? Bool == true)
    }

    @Test func registeringNeverOverwritesTheOwnersChoice() throws {
        let domain = try EmptyDomain()
        domain.defaults.set(false, forKey: storageKey)
        MenuBarOnlyPreference.registerDefaults(in: domain.defaults)
        #expect(!MenuBarOnlyPreference(defaults: domain.defaults, domainName: domain.name).isOn)
    }

    @Test func aValueOnlyInAnotherSearchedDomainIsIgnored() throws {
        let domain = try EmptyDomain()
        let searched = try EmptyDomain()
        defer { searched.defaults.removePersistentDomain(forName: searched.name) }
        searched.defaults.set(false, forKey: storageKey)
        domain.defaults.addSuite(named: searched.name)
        #expect(MenuBarOnlyPreference(defaults: domain.defaults, domainName: domain.name).isOn)
    }
}
