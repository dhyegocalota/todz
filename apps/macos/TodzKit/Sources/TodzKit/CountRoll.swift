public enum CountRoll {
    // NB ADR 0106: the menu bar count rolls in template frames under the 350 ms motion ceiling, and a roll under Reduce Motion is a crossfade.
    public static let rise = 6.0

    public static func frames(isMotionReduced: Bool) -> [CountRollFrame] {
        let token = MotionRule.token(.bloom, isReduceMotionOn: isMotionReduced)
        let frameCount = token.durationMilliseconds * RibbonMotion.framesPerSecond / Int(millisecondsPerSecond)
        let distance = token == .crossfade ? 0 : rise
        return (1...frameCount).map { index in
            let progress = easedOut(Double(index) / Double(frameCount))
            return CountRollFrame(
                outgoingRise: distance * progress,
                outgoingOpacity: 1 - progress,
                incomingRise: -distance * (1 - progress),
                incomingOpacity: progress,
                duration: .seconds(1) / RibbonMotion.framesPerSecond
            )
        }
    }

    public static func isRolling(from previous: String?, to next: String?) -> Bool {
        guard let previous, let next else { return false }
        return previous != next
    }

    private static func easedOut(_ progress: Double) -> Double {
        1 - (1 - progress) * (1 - progress)
    }
}
