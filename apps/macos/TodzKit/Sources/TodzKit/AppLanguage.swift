import Foundation

private let chineseCode = "zh"
private let traditionalScript = "Hant"
private let traditionalRegions: Set<String> = ["TW", "HK", "MO"]

public enum AppLanguage: String, CaseIterable, Sendable {
    case english = "en"
    case portugueseBrazil = "pt-BR"
    case spanish = "es"
    case german = "de"
    case french = "fr"
    case japanese = "ja"
    case korean = "ko"
    case chinese = "zh"
    case arabic = "ar"
    case hindi = "hi"

    public var nativeName: String {
        switch self {
        case .english: "English"
        case .portugueseBrazil: "Português (Brasil)"
        case .spanish: "Español"
        case .german: "Deutsch"
        case .french: "Français"
        case .japanese: "日本語"
        case .korean: "한국어"
        case .chinese: "简体中文"
        case .arabic: "العربية"
        case .hindi: "हिन्दी"
        }
    }

    public var isRightToLeft: Bool {
        self == .arabic
    }

    public static func bestMatch(preferred: [String]) -> AppLanguage {
        guard let match = preferred.lazy.compactMap(spoken(in:)).first else { return .english }
        return match
    }

    private var code: String? {
        Locale.Language(identifier: rawValue).languageCode?.identifier
    }

    private static func spoken(in identifier: String) -> AppLanguage? {
        let language = Locale.Language(identifier: identifier)
        guard let code = language.languageCode?.identifier else { return nil }
        let isTraditionalChinese = code == chineseCode && isTraditional(language)
        guard !isTraditionalChinese else { return nil }
        return allCases.first { $0.code == code }
    }

    private static func isTraditional(_ language: Locale.Language) -> Bool {
        guard let script = language.script else { return language.region.map { traditionalRegions.contains($0.identifier) } == true }
        return script.identifier == traditionalScript
    }
}
