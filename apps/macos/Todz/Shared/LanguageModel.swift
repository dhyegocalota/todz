import AppKit
import Observation
import os
import TodzKit

@MainActor @Observable final class LanguageModel {
    private(set) var choice: LanguageChoice
    private(set) var appearance: AppearanceChoice
    private(set) var language: AppLanguage

    @ObservationIgnored private let languagePreference: LanguagePreference
    @ObservationIgnored private let appearancePreference: AppearancePreference
    @ObservationIgnored private let reloadWidgets: @Sendable () -> Void
    @ObservationIgnored private let logger = Logger(subsystem: "dev.todz", category: "language")

    init(languagePreference: LanguagePreference, appearancePreference: AppearancePreference, reloadWidgets: @escaping @Sendable () -> Void) {
        self.languagePreference = languagePreference
        self.appearancePreference = appearancePreference
        self.reloadWidgets = reloadWidgets
        choice = Self.storedChoice(languagePreference, logger: logger)
        appearance = Self.storedAppearance(appearancePreference, logger: logger)
        language = Localized.language
    }

    var locale: Locale {
        Locale(identifier: language.rawValue)
    }

    func select(_ newChoice: LanguageChoice) {
        languagePreference.store(newChoice)
        choice = newChoice
        language = Localized.language
        reloadWidgets()
    }

    func select(_ newAppearance: AppearanceChoice) {
        appearancePreference.store(newAppearance)
        appearance = newAppearance
        applyAppearance()
    }

    func applyAppearance() {
        NSApp.appearance = appearance.appearanceName.flatMap(NSAppearance.init(named:))
    }

    private static func storedChoice(_ preference: LanguagePreference, logger: Logger) -> LanguageChoice {
        do {
            return try preference.choice()
        } catch {
            logger.error("The stored language was refused: \(error.localizedDescription, privacy: .public)")
            return .system
        }
    }

    private static func storedAppearance(_ preference: AppearancePreference, logger: Logger) -> AppearanceChoice {
        do {
            return try preference.choice()
        } catch {
            logger.error("The stored appearance was refused: \(error.localizedDescription, privacy: .public)")
            return .system
        }
    }
}
