public enum PerfProbeLine: Sendable, Equatable {
    case launchReady(milliseconds: Int)
    case scroll(frames: Int, overBudget: Int, worstMilliseconds: Int, refreshMilliseconds: Int)
    case footprint(megabytes: Int)
    case taskArrived(number: Int, atMilliseconds: Int)

    public var text: String {
        ""
    }
}
