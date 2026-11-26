public enum UpdateUserAgent {
    public static func text(appVersion: String, sparkleVersion: String, macosMajor: Int) -> String {
        "Todz/\(appVersion) Sparkle/\(sparkleVersion) macOS/\(macosMajor)"
    }
}
