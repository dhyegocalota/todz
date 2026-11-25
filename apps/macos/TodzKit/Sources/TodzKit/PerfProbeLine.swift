import Foundation

public enum PerfProbeLine: Sendable, Equatable {
    case launchReady(milliseconds: Int)
    case scroll(frames: Int, overBudget: Int, worstMilliseconds: Int, refreshMilliseconds: Int)
    case footprint(megabytes: Int)
    case taskArrived(number: Int, atMilliseconds: Int)

    public static func taskArrived(number: Int, at instant: Date) -> PerfProbeLine {
        .taskArrived(number: number, atMilliseconds: Int((instant.timeIntervalSince1970 * millisecondsPerSecond).rounded()))
    }

    public var text: String {
        switch self {
        case let .launchReady(milliseconds):
            "launch-ready ms=\(milliseconds)"
        case let .scroll(frames, overBudget, worstMilliseconds, refreshMilliseconds):
            "scroll frames=\(frames) over-budget=\(overBudget) worst-ms=\(worstMilliseconds) refresh-ms=\(refreshMilliseconds)"
        case let .footprint(megabytes):
            "footprint mb=\(megabytes)"
        case let .taskArrived(number, atMilliseconds):
            "task-arrived number=\(number) at-ms=\(atMilliseconds)"
        }
    }
}
