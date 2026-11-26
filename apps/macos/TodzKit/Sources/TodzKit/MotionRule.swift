public enum MotionRule {
    // NB ADR 0077: with Reduce Motion on, every token becomes a crossfade, so no spring, scale or offset plays.
    public static func token(_ requested: MotionToken, isReduceMotionOn: Bool) -> MotionToken {
        fatalError("MotionRule.token is not implemented")
    }
}
