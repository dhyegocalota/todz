import Observation
import SwiftUI
import TodzKit

@MainActor @Observable final class MenuBarRibbonStripCache {
    @ObservationIgnored private var held: (content: RibbonContent, isMotionReduced: Bool, strip: MenuBarRibbonStrip)?

    func strip(content: RibbonContent, isMotionReduced: Bool) -> MenuBarRibbonStrip {
        if let held, held.content == content, held.isMotionReduced == isMotionReduced { return held.strip }
        let strip = MenuBarRibbonImage.strip(content: content, isMotionReduced: isMotionReduced)
        held = (content, isMotionReduced, strip)
        return strip
    }
}

struct MenuBarRibbonLabel: View, Equatable {
    let presentation: RibbonPresentation
    let displayScale: CGFloat
    let strips: MenuBarRibbonStripCache

    var body: some View {
        let strip = strips.strip(content: presentation.content, isMotionReduced: presentation.isMotionReduced)
        Image(nsImage: MenuBarRibbonImage.frame(strip: strip, frame: presentation.frame, displayScale: displayScale))
    }

    nonisolated static func == (left: MenuBarRibbonLabel, right: MenuBarRibbonLabel) -> Bool {
        left.presentation == right.presentation && left.displayScale == right.displayScale
    }
}
