import Testing
@testable import TodzKit

@Suite struct AppLanguageTests {
    @Test func theEightLanguagesAreInTheOrderOfTheSelector() {
        #expect(AppLanguage.allCases.map(\.rawValue) == ["en", "pt-BR", "es", "de", "fr", "ja", "ko", "zh"])
    }

    @Test func eachLanguageIsNamedInItself() {
        #expect(AppLanguage.allCases.map(\.nativeName) == ["English", "Português (Brasil)", "Español", "Deutsch", "Français", "日本語", "한국어", "简体中文"])
    }

    @Test(arguments: [
        (["pt-BR"], AppLanguage.portugueseBrazil),
        (["pt-PT"], .portugueseBrazil),
        (["es-MX", "en-US"], .spanish),
        (["de-AT"], .german),
        (["fr-CA"], .french),
        (["ja-JP"], .japanese),
        (["ko-KR"], .korean),
        (["zh-Hans-CN"], .chinese),
        (["zh-CN"], .chinese),
        (["en-GB"], .english),
    ])
    func theSystemsBestMatchAmongTheEightWins(preferred: [String], expected: AppLanguage) {
        #expect(AppLanguage.bestMatch(preferred: preferred) == expected)
    }

    @Test func theFirstPreferredLanguageThatTheAppSpeaksWins() {
        #expect(AppLanguage.bestMatch(preferred: ["it-IT", "ko-KR", "en-US"]) == .korean)
    }

    @Test func traditionalChineseIsNotSimplified() {
        #expect(AppLanguage.bestMatch(preferred: ["zh-Hant-TW", "de-DE"]) == .german)
        #expect(AppLanguage.bestMatch(preferred: ["zh-HK"]) == .english)
    }

    @Test func aLanguageTheAppDoesNotSpeakFallsBackToEnglish() {
        #expect(AppLanguage.bestMatch(preferred: ["it-IT", "ru-RU"]) == .english)
        #expect(AppLanguage.bestMatch(preferred: []) == .english)
    }
}
