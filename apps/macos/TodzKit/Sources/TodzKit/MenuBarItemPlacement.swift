import CoreGraphics

public enum MenuBarItemPlacement {
    public static func isOnTheBar(itemFrame: CGRect, screenFrames: [CGRect]) -> Bool {
        screenFrames.contains { screen in
            let isAcrossTheScreen = screen.minX <= itemFrame.midX && itemFrame.midX <= screen.maxX
            let distanceFromTheTop = screen.maxY - itemFrame.midY
            let isInTheTopBand = distanceFromTheTop >= 0 && distanceFromTheTop <= itemFrame.height
            return isAcrossTheScreen && isInTheTopBand
        }
    }
}
