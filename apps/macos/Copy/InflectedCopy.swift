import Foundation

enum InflectedCopy {
    static func text(_ value: String.LocalizationValue) -> String {
        String(AttributedString(localized: value).characters)
    }
}
