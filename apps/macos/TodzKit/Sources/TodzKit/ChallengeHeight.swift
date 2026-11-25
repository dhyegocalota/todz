import Foundation

public enum ChallengeHeight {
    public static let minimum = 65.0
    public static let maximum = 500.0
    public static let handlerName = "turnstileHeight"
    public static let observerScript = ""

    public static func clamped(reported: Double) -> Double {
        reported
    }
}
