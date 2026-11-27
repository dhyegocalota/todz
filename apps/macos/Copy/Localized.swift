import Foundation
import os
import TodzKit

private let appGroupKey = "TodzAppGroup"
private let logCategory = "language"

enum Localized {
    private static let bundles = OSAllocatedUnfairLock<[AppLanguage: Bundle]>(initialState: [:])
    private static let logger = Logger(subsystem: "dev.todz", category: logCategory)

    static var language: AppLanguage {
        do {
            return try LanguagePreference(defaults: groupDefaults).effective(preferred: Locale.preferredLanguages)
        } catch {
            logger.error("The stored language was refused: \(error.localizedDescription, privacy: .public)")
            return AppLanguage.bestMatch(preferred: Locale.preferredLanguages)
        }
    }

    static var locale: Locale {
        Locale(identifier: language.rawValue)
    }

    static var groupDefaults: UserDefaults {
        guard let group = Bundle.main.object(forInfoDictionaryKey: appGroupKey) as? String else {
            fatalError("\(appGroupKey) is missing from the Info.plist")
        }
        guard let defaults = UserDefaults(suiteName: group) else {
            fatalError("The App Group \(group) has no defaults")
        }
        return defaults
    }

    static func text(_ value: String.LocalizationValue) -> String {
        let spoken = language
        return String(localized: value, bundle: bundle(of: spoken), locale: Locale(identifier: spoken.rawValue))
    }

    static func attributed(_ value: String.LocalizationValue) -> AttributedString {
        let spoken = language
        return AttributedString(localized: value, bundle: bundle(of: spoken), locale: Locale(identifier: spoken.rawValue))
    }

    private static func bundle(of spoken: AppLanguage) -> Bundle {
        bundles.withLock { cached in
            if let found = cached[spoken] { return found }
            do {
                let found = try LanguageBundle.of(language: spoken, in: .main)
                cached[spoken] = found
                return found
            } catch {
                fatalError("The app has no \(spoken.rawValue) strings: \(error)")
            }
        }
    }
}
