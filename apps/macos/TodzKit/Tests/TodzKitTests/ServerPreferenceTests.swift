import Foundation
import Testing
@testable import TodzKit

private let storedKey = "serverURL"
private let address = "https://todz.example.com"

private struct FreshDomain {
    let name = UUID().uuidString
    let defaults: UserDefaults

    init() throws {
        defaults = try #require(UserDefaults(suiteName: name))
        defaults.removePersistentDomain(forName: name)
    }

    var preference: ServerPreference {
        ServerPreference(defaults: defaults, domainName: name)
    }
}

@Suite struct ServerPreferenceTests {
    @Test func nothingStoredReadsAsNoAddressAndNoUnreadableValue() throws {
        let preference = try FreshDomain().preference
        #expect(preference.storedAddress() == nil)
        #expect(!preference.hasUnreadableValue)
    }

    @Test func aStoredAddressReadsBack() throws {
        let preference = try FreshDomain().preference
        let stored = try ServerAddress.checked(text: address).get()
        preference.store(stored)
        #expect(preference.storedAddress() == stored)
        #expect(!preference.hasUnreadableValue)
    }

    @Test func aStoredTextThatDoesNotParseReadsAsNoAddressAndAnUnreadableValue() throws {
        let domain = try FreshDomain()
        domain.defaults.set("not a url", forKey: storedKey)
        #expect(domain.preference.storedAddress() == nil)
        #expect(domain.preference.hasUnreadableValue)
    }

    @Test func clearingForgetsTheStoredAddress() throws {
        let preference = try FreshDomain().preference
        preference.store(try ServerAddress.checked(text: address).get())
        preference.clear()
        #expect(preference.storedAddress() == nil)
        #expect(!preference.hasUnreadableValue)
    }

    @Test(arguments: [address, "not a url"])
    func aValueOnlyInAnotherSearchedDomainIsIgnored(text: String) throws {
        let domain = try FreshDomain()
        let searched = try FreshDomain()
        defer { searched.defaults.removePersistentDomain(forName: searched.name) }
        searched.defaults.set(text, forKey: storedKey)
        domain.defaults.addSuite(named: searched.name)
        #expect(domain.defaults.string(forKey: storedKey) == text)
        #expect(domain.preference.storedAddress() == nil)
        #expect(!domain.preference.hasUnreadableValue)
    }
}
