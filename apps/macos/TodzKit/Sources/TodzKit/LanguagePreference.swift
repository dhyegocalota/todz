import Foundation

public enum LanguagePreferenceError: Error, Equatable {
    case unknownLanguage(String)
}

public struct LanguagePreference {
    public static let storageKey = "language"

    private let defaults: UserDefaults

    public init(defaults: UserDefaults) {
        self.defaults = defaults
    }

    public func choice() throws -> LanguageChoice {
        guard let stored = defaults.object(forKey: Self.storageKey) else { return .system }
        guard let text = stored as? String, let choice = LanguageChoice(storageValue: text) else {
            throw LanguagePreferenceError.unknownLanguage("\(stored)")
        }
        return choice
    }

    public func effective(preferred: [String]) throws -> AppLanguage {
        switch try choice() {
        case .system: AppLanguage.bestMatch(preferred: preferred)
        case let .language(language): language
        }
    }

    public func store(_ choice: LanguageChoice) {
        defaults.set(choice.storageValue, forKey: Self.storageKey)
    }
}
