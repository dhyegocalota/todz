import Foundation
import Testing
@testable import TodzKit

private let storageKey = "language"

@Suite struct LanguagePreferenceTests {
    @Test func aFreshDomainChoosesTheSystem() throws {
        let domain = try EmptyDomain()
        let preference = LanguagePreference(defaults: domain.defaults)
        #expect(try preference.choice() == .system)
    }

    @Test func theStorageKeyIsStable() {
        #expect(LanguagePreference.storageKey == storageKey)
    }

    @Test func theChoicesAreTheSystemThenTheTenLanguages() {
        #expect(LanguageChoice.all == [.system] + AppLanguage.allCases.map(LanguageChoice.language))
    }

    @Test(arguments: LanguageChoice.all)
    func storingRoundTripsInTheGivenDefaults(choice: LanguageChoice) throws {
        let domain = try EmptyDomain()
        let preference = LanguagePreference(defaults: domain.defaults)
        preference.store(choice)
        #expect(try preference.choice() == choice)
        #expect(domain.defaults.string(forKey: storageKey) == choice.storageValue)
    }

    @Test func anOverrideWinsOverTheSystemsLanguages() throws {
        let domain = try EmptyDomain()
        let preference = LanguagePreference(defaults: domain.defaults)
        preference.store(.language(.japanese))
        #expect(try preference.effective(preferred: ["de-DE"]) == .japanese)
    }

    @Test func theSystemChoiceFollowsTheSystemsBestMatch() throws {
        let domain = try EmptyDomain()
        let preference = LanguagePreference(defaults: domain.defaults)
        #expect(try preference.effective(preferred: ["de-DE"]) == .german)
        #expect(try preference.effective(preferred: ["it-IT"]) == .english)
    }

    @Test func aStoredValueOutsideTheTenIsRefused() throws {
        let domain = try EmptyDomain()
        domain.defaults.set("tlh", forKey: storageKey)
        let preference = LanguagePreference(defaults: domain.defaults)
        #expect(throws: LanguagePreferenceError.unknownLanguage("tlh")) { try preference.choice() }
        #expect(throws: LanguagePreferenceError.unknownLanguage("tlh")) { try preference.effective(preferred: ["en-US"]) }
    }

    @Test func aStoredValueThatIsNotTextIsRefused() throws {
        let domain = try EmptyDomain()
        domain.defaults.set(7, forKey: storageKey)
        let preference = LanguagePreference(defaults: domain.defaults)
        #expect(throws: LanguagePreferenceError.unknownLanguage("7")) { try preference.choice() }
    }
}
