import SwiftUI

struct MenuBarCountLabel: View, Equatable {
    let badgeText: String
    let opacity: Double
    let displayScale: CGFloat

    var body: some View {
        Image(nsImage: MenuBarCountImage.render(badgeText: badgeText, opacity: opacity, displayScale: displayScale))
    }
}
