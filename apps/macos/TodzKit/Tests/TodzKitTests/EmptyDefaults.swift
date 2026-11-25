import Foundation
import Testing

func emptyDefaults() throws -> UserDefaults {
    let suiteName = UUID().uuidString
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defaults.removePersistentDomain(forName: suiteName)
    return defaults
}
