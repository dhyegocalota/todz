import Foundation
import Testing
@testable import TodzKit

@Suite struct MenuBarBadgeDefaultsTests {
    @Test func aRegisteredDefaultReadsOnForAFreshDefaultsStore() throws {
        let defaults = try emptyDefaults()
        MenuBarBadge.registerDefault(in: defaults)
        #expect(defaults.bool(forKey: MenuBarBadge.storageKey) == MenuBarBadge.isEnabledByDefault)
        #expect(defaults.bool(forKey: MenuBarBadge.storageKey))
    }

    @Test func registeringNeverOverwritesTheOwnersChoice() throws {
        let defaults = try emptyDefaults()
        defaults.set(false, forKey: MenuBarBadge.storageKey)
        MenuBarBadge.registerDefault(in: defaults)
        #expect(!defaults.bool(forKey: MenuBarBadge.storageKey))
    }
}
