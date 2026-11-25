public enum RibbonMotion {
    // NB ADR 0071: the item unfolds and folds in 0.25 s, holds 5 s or scrolls once at 40 points per second between 1.5 s holds, so the longest ribbon lasts 9.5 s.
    public static let windowWidth = 180.0
    public static let stripMaxWidth = 420.0
    public static let framesPerSecond = 30
    public static let foldDuration = Duration.seconds(0.25)
    public static let dwell = Duration.seconds(5)
    public static let edgeHold = Duration.seconds(1.5)
    public static let scrollSpeed = 40.0
    static let foldFrameCount = 8

    public static func timeline(textWidth: Double, isMotionReduced: Bool) -> [RibbonFrame] {
        guard !isMotionReduced else { return [held(offset: 0, duration: dwell)] }
        let overflow = max(0, min(textWidth, stripMaxWidth) - windowWidth)
        guard overflow > 0 else { return unfolding + [held(offset: 0, duration: dwell)] + folding(offset: 0) }
        return unfolding + [held(offset: 0, duration: edgeHold)] + scrolling(overflow: overflow) + [held(offset: overflow, duration: edgeHold)] + folding(offset: overflow)
    }

    private static var unfolding: [RibbonFrame] {
        (1...foldFrameCount).map { RibbonFrame(reveal: Double($0) / Double(foldFrameCount), offset: 0, duration: foldDuration / foldFrameCount) }
    }

    private static func folding(offset: Double) -> [RibbonFrame] {
        (0..<foldFrameCount).reversed().map {
            RibbonFrame(reveal: Double($0) / Double(foldFrameCount), offset: offset, duration: foldDuration / foldFrameCount)
        }
    }

    private static func scrolling(overflow: Double) -> [RibbonFrame] {
        let frameCount = Int((overflow * Double(framesPerSecond) / scrollSpeed).rounded(.up))
        return (1...frameCount).map {
            RibbonFrame(
                reveal: 1,
                offset: min(overflow, Double($0) * scrollSpeed / Double(framesPerSecond)),
                duration: .seconds(1) / framesPerSecond
            )
        }
    }

    private static func held(offset: Double, duration: Duration) -> RibbonFrame {
        RibbonFrame(reveal: 1, offset: offset, duration: duration)
    }
}
