import Foundation

public enum MotionShake {
    public static let travel: Double = 8
    public static let cycles: Double = 3
    public static let duration: Double = 0.4

    public static func offset(progress: Double, isReduceMotionOn: Bool) -> Double {
        guard !isReduceMotionOn else { return 0 }
        return travel * sin(progress * .pi * 2 * cycles)
    }
}
