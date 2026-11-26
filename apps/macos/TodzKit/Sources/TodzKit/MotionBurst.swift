public enum MotionBurst {
    // NB ADR 0077: the completion burst starts visible at the centre and spreads while it fades; it rests hidden.
    public static func opacity(isBursting: Bool, isSpread: Bool) -> Double {
        guard isBursting else { return 0 }
        return isSpread ? 0 : 1
    }

    public static func spreadFraction(isSpread: Bool) -> Double {
        isSpread ? 1 : 0
    }
}
