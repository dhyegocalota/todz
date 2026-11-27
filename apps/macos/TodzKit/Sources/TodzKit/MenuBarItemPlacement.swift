import CoreGraphics

public enum MenuBarItemPlacement {
    public static func isOnTheBar(itemFrame: CGRect, screenFrames: [CGRect]) -> Bool {
        guard !screenFrames.isEmpty else { return true }
        return screenFrames.contains { screen in
            let isAcrossTheScreen = screen.minX <= itemFrame.midX && itemFrame.midX <= screen.maxX
            let distanceFromTheTop = screen.maxY - itemFrame.midY
            return isAcrossTheScreen && distanceFromTheTop <= itemFrame.height
        }
    }
}
