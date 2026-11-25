import Foundation

private let shortVersionKey = "CFBundleShortVersionString"

public enum AppVersion {
    public static func of(info: [String: Any]) -> String? {
        info[shortVersionKey] as? String
    }

    public static func required(bundle: Bundle) -> String {
        guard let info = bundle.infoDictionary, let version = of(info: info) else {
            preconditionFailure("\(shortVersionKey) is missing from the Info.plist of \(bundle.bundleURL.lastPathComponent)")
        }
        return version
    }
}
