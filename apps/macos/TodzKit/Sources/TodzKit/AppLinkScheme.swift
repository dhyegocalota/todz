import Foundation

public enum AppLinkScheme: String, Sendable {
    case release = "todz"
    case debug = "todz-dev"

    public static func of(info: [String: Any]) -> AppLinkScheme? {
        nil
    }
}
