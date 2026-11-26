import Foundation

public enum MenuBarLayout {
    public static let glyphTrailingInset = 2.5
    public static let countGap = 1.5
    public static let countRise = 0.5

    public static var glyphSpacing: Double {
        countGap - glyphTrailingInset
    }

    public static func textOrigin(glyphWidth: Double) -> Double {
        glyphWidth + glyphSpacing
    }
}
