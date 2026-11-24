import Foundation

public enum SignInLinkTiming {
    public static let lifetime: TimeInterval = 15 * 60
    public static let cooldown: TimeInterval = 30
    static let margin: TimeInterval = 5 * 60
}
