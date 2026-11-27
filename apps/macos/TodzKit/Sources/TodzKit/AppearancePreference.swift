import Foundation

public enum AppearancePreferenceError: Error, Equatable {
    case unknownAppearance(String)
}

public struct AppearancePreference {
    public static let storageKey = "appearance"

    private let domain: PersistentDomain

    public init(defaults: UserDefaults, domainName: String) {
        domain = PersistentDomain(defaults: defaults, name: domainName)
    }

    public func choice() throws -> AppearanceChoice {
        guard let stored = domain.value(forKey: Self.storageKey) else { return .system }
        guard let text = stored as? String, let choice = AppearanceChoice(rawValue: text) else {
            throw AppearancePreferenceError.unknownAppearance("\(stored)")
        }
        return choice
    }

    public func store(_ choice: AppearanceChoice) {
        domain.set(choice.rawValue, forKey: Self.storageKey)
    }
}
