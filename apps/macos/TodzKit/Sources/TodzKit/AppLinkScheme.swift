import Foundation

private let linkSchemeKey = "TodzLinkScheme"

public enum AppLinkScheme: String, Encodable, Sendable {
    case release = "todz"
    case debug = "todz-dev"

    // NB ADR 0058: each build reads its own scheme from its Info.plist and never defaults to another build's.
    public static func of(info: [String: Any]) -> AppLinkScheme? {
        guard let text = info[linkSchemeKey] as? String else { return nil }
        return AppLinkScheme(rawValue: text)
    }

    public static func of(bundle: Bundle) -> AppLinkScheme? {
        guard let info = bundle.infoDictionary else { return nil }
        return of(info: info)
    }
}
