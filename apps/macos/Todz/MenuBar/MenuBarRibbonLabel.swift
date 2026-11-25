import Observation
import SwiftUI
import TodzKit

@MainActor @Observable final class MenuBarRibbonStripCache {
    @ObservationIgnored private var held: (content: RibbonContent, strip: MenuBarRibbonStrip)?

    func strip(content: RibbonContent) -> MenuBarRibbonStrip {
        if let held, held.content == content { return held.strip }
        let strip = MenuBarRibbonImage.strip(content: content)
        held = (content, strip)
        return strip
    }
}

struct MenuBarRibbonLabel: View, Equatable {
    let content: RibbonContent
    let frame: RibbonFrame
    let displayScale: CGFloat
    let strips: MenuBarRibbonStripCache

    var body: some View {
        let strip = strips.strip(content: content)
        Image(nsImage: MenuBarRibbonImage.frame(strip: strip, frame: frame, displayScale: displayScale))
    }

    nonisolated static func == (left: MenuBarRibbonLabel, right: MenuBarRibbonLabel) -> Bool {
        left.content == right.content && left.frame == right.frame && left.displayScale == right.displayScale
    }
}
