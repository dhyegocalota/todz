import Foundation

public struct HitchReport: Sendable, Equatable {
    public let frames: Int
    public let overBudget: Int
    public let worstMilliseconds: Int
    public let refreshMilliseconds: Int
}

public struct HitchCounter: Sendable {
    public init(refreshRate: Double) {}

    public mutating func record(timestamp: TimeInterval) {}

    public var report: HitchReport {
        HitchReport(frames: -1, overBudget: -1, worstMilliseconds: -1, refreshMilliseconds: -1)
    }
}
