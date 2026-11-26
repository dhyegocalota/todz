public enum MotionBloom {
    // NB ADR 0077: a bloom rests fully visible and is dimmed only while it enters.
    public static let dimmedScale = 0.96

    public static func opacity(isBloomed: Bool) -> Double {
        isBloomed ? 1 : 0
    }

    public static func scale(isBloomed: Bool, isReduceMotionOn: Bool) -> Double {
        guard isBloomed || isReduceMotionOn else { return dimmedScale }
        return 1
    }
}
