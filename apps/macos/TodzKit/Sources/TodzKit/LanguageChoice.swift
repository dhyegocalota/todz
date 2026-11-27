private let systemStorageValue = "system"

public enum LanguageChoice: Hashable, Sendable {
    case system
    case language(AppLanguage)

    public static let all: [LanguageChoice] = [.system] + AppLanguage.allCases.map(LanguageChoice.language)

    public var storageValue: String {
        switch self {
        case .system: systemStorageValue
        case let .language(language): language.rawValue
        }
    }

    public init?(storageValue: String) {
        guard let choice = Self.all.first(where: { $0.storageValue == storageValue }) else { return nil }
        self = choice
    }
}
