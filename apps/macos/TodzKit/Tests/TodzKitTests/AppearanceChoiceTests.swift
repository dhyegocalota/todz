import AppKit
import Testing
@testable import TodzKit

private let storageKey = "appearance"

@Suite struct AppearanceChoiceTests {
    @Test func theChoicesAreSystemLightAndDark() {
        #expect(AppearanceChoice.allCases == [.system, .light, .dark])
    }

    @Test func systemLeavesTheAppearanceToTheMacAndTheOthersPinIt() {
        #expect(AppearanceChoice.system.appearanceName == nil)
        #expect(AppearanceChoice.light.appearanceName == .aqua)
        #expect(AppearanceChoice.dark.appearanceName == .darkAqua)
    }

    @Test func aFreshDomainChoosesTheSystem() throws {
        let domain = try EmptyDomain()
        #expect(try AppearancePreference(defaults: domain.defaults, domainName: domain.name).choice() == .system)
    }

    @Test(arguments: AppearanceChoice.allCases)
    func storingRoundTrips(choice: AppearanceChoice) throws {
        let domain = try EmptyDomain()
        let preference = AppearancePreference(defaults: domain.defaults, domainName: domain.name)
        preference.store(choice)
        #expect(try preference.choice() == choice)
    }

    @Test func aStoredValueOutsideTheThreeIsRefused() throws {
        let domain = try EmptyDomain()
        domain.defaults.set("sepia", forKey: storageKey)
        let preference = AppearancePreference(defaults: domain.defaults, domainName: domain.name)
        #expect(throws: AppearancePreferenceError.unknownAppearance("sepia")) { try preference.choice() }
    }
}
