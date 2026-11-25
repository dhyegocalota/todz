import Foundation
import Testing
@testable import TodzKit

private let storedKey = "serverURL"
private let address = "https://todz.example.com"

private func freshDefaults() throws -> UserDefaults {
    let suiteName = UUID().uuidString
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defaults.removePersistentDomain(forName: suiteName)
    return defaults
}

@Suite struct ServerPreferenceTests {
    @Test func nothingStoredReadsAsNoAddressAndNoUnreadableValue() throws {
        let preference = ServerPreference(defaults: try freshDefaults())
        #expect(preference.storedAddress() == nil)
        #expect(!preference.hasUnreadableValue)
    }

    @Test func aStoredAddressReadsBack() throws {
        let preference = ServerPreference(defaults: try freshDefaults())
        let stored = try ServerAddress.checked(text: address).get()
        preference.store(stored)
        #expect(preference.storedAddress() == stored)
        #expect(!preference.hasUnreadableValue)
    }

    @Test func aStoredTextThatDoesNotParseReadsAsNoAddressAndAnUnreadableValue() throws {
        let defaults = try freshDefaults()
        defaults.set("not a url", forKey: storedKey)
        let preference = ServerPreference(defaults: defaults)
        #expect(preference.storedAddress() == nil)
        #expect(preference.hasUnreadableValue)
    }

    @Test func clearingForgetsTheStoredAddress() throws {
        let preference = ServerPreference(defaults: try freshDefaults())
        preference.store(try ServerAddress.checked(text: address).get())
        preference.clear()
        #expect(preference.storedAddress() == nil)
        #expect(!preference.hasUnreadableValue)
    }
}
