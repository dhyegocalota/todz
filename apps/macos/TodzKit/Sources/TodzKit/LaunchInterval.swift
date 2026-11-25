import Foundation

public enum LaunchInterval {
    public static func milliseconds(processStart: TimeInterval, firstRows: TimeInterval) -> Int {
        Int(((firstRows - processStart) * millisecondsPerSecond).rounded())
    }
}
