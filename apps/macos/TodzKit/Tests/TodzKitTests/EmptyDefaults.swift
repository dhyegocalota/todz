import Foundation
import Testing

struct EmptyDomain {
    let name = UUID().uuidString
    let defaults: UserDefaults

    init() throws {
        defaults = try #require(UserDefaults(suiteName: name))
        defaults.removePersistentDomain(forName: name)
    }
}

func emptyDefaults() throws -> UserDefaults {
    try EmptyDomain().defaults
}
