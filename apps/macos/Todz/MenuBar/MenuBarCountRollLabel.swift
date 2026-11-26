import SwiftUI
import TodzKit

struct MenuBarCountRollLabel: View, Equatable {
    let presentation: CountRollPresentation
    let opacity: Double
    let displayScale: CGFloat

    var body: some View {
        Image(nsImage: MenuBarCountImage.renderRoll(presentation: presentation, opacity: opacity, displayScale: displayScale))
    }
}
