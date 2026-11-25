import Foundation

private let budgetInFrames = 1.5

public struct HitchReport: Sendable, Equatable {
    public let frames: Int
    public let overBudget: Int
    public let worstMilliseconds: Int
    public let refreshMilliseconds: Int
}

public struct HitchCounter: Sendable {
    private let refreshInterval: TimeInterval
    private var lastTimestamp: TimeInterval?
    private var frames = 0
    private var overBudget = 0
    private var worstGap: TimeInterval = 0

    public init(refreshRate: Double) {
        refreshInterval = 1 / refreshRate
    }

    public mutating func record(timestamp: TimeInterval) {
        frames += 1
        defer { lastTimestamp = timestamp }
        guard let lastTimestamp else { return }
        let gap = timestamp - lastTimestamp
        worstGap = max(worstGap, gap)
        guard gap > refreshInterval * budgetInFrames else { return }
        overBudget += 1
    }

    public var report: HitchReport {
        HitchReport(
            frames: frames,
            overBudget: overBudget,
            worstMilliseconds: Int((worstGap * millisecondsPerSecond).rounded()),
            refreshMilliseconds: Int((refreshInterval * millisecondsPerSecond).rounded())
        )
    }
}
