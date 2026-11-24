import Foundation
import Testing
@testable import TodzKit

private func freshDefaults() throws -> UserDefaults {
    let suiteName = UUID().uuidString
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defaults.removePersistentDomain(forName: suiteName)
    return defaults
}

@Suite struct MenuBarBadgeDefaultsTests {
    @Test func aRegisteredDefaultReadsOnForAFreshDefaultsStore() throws {
        let defaults = try freshDefaults()
        MenuBarBadge.registerDefault(in: defaults)
        #expect(defaults.bool(forKey: MenuBarBadge.storageKey) == MenuBarBadge.isEnabledByDefault)
        #expect(defaults.bool(forKey: MenuBarBadge.storageKey))
    }

    @Test func anUnregisteredKeyReadsOffWhichIsWhyTheDefaultIsRegistered() throws {
        let defaults = try freshDefaults()
        #expect(!defaults.bool(forKey: MenuBarBadge.storageKey))
    }

    @Test func registeringNeverOverwritesTheOwnersChoice() throws {
        let defaults = try freshDefaults()
        defaults.set(false, forKey: MenuBarBadge.storageKey)
        MenuBarBadge.registerDefault(in: defaults)
        #expect(!defaults.bool(forKey: MenuBarBadge.storageKey))
    }
}
