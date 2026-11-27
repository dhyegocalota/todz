import Foundation

private let languageFolderExtension = "lproj"

public enum LanguageBundleError: Error, Equatable {
    case missing(AppLanguage)
}

public enum LanguageBundle {
    public static func of(language: AppLanguage, in bundle: Bundle) throws -> Bundle {
        guard let folder = bundle.url(forResource: language.rawValue, withExtension: languageFolderExtension), let found = Bundle(url: folder) else {
            throw LanguageBundleError.missing(language)
        }
        return found
    }
}
