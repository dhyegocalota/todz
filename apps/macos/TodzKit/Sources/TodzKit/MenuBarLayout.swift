import Foundation

public enum MenuBarLayout {
    public static let glyphTrailingInset = 2.5
    public static let countGap = 10.5
    public static let countRise = 0.0

    public static var glyphSpacing: Double {
        countGap - glyphTrailingInset
    }

    public static func textOrigin(glyphWidth: Double) -> Double {
        glyphWidth + glyphSpacing
    }
}
