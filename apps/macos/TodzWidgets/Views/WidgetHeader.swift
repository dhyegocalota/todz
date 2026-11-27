import SwiftUI
import TodzKit

struct WidgetHeader: View {
    let title: String
    let spokenTitle: String
    let openCount: Int?

    var body: some View {
        HStack {
            WidgetBrandGlyph()
            Text(title)
                .font(.headline)
                .lineLimit(1)
                .truncationMode(.tail)
                .accessibilityLabel(spokenTitle)
            Spacer()
            if let openCount {
                Text(MenuBarCopy.left(count: openCount))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .todzCountTransition()
                    .invalidatableContent()
            }
        }
        .accessibilityElement(children: .combine)
    }
}
