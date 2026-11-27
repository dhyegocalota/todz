public enum MotionStagger {
    // NB ADR 0114: a cascade starts each of the first six rows 12 ms after the one before, and only when the whole choreography fits the 350 ms ceiling.
    public static let stepMilliseconds = 12
    public static let staggeredRows = 6

    public static func delayMilliseconds(index: Int, token: MotionToken) -> Int {
        let longestDelay = (staggeredRows - 1) * stepMilliseconds
        guard token.durationMilliseconds + longestDelay <= MotionTiming.ceilingMilliseconds else { return 0 }
        return min(index, staggeredRows - 1) * stepMilliseconds
    }
}
