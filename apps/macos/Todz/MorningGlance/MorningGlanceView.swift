import SwiftUI
import TodzKit

let morningGlanceWidth: CGFloat = 280

struct MorningGlanceView: View {
    let content: MorningGlanceContent
    let open: () -> Void

    var body: some View {
        TodayDigest(openCount: content.openCount, subtitle: nil, rows: content.rows, restCount: content.restCount)
            .padding()
            .frame(width: morningGlanceWidth, alignment: .leading)
            .modifier(GlassSurface(cornerRadius: FormMetrics.panelCornerRadius))
            .todzEntrance()
            .help(MorningGlanceCopy.openToday)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(AccessibilityCopy.morningGlance(count: content.openCount))
            .accessibilityValue(content.rows.map(\.title).joined(separator: ", "))
            .accessibilityHint(AccessibilityCopy.glanceOpensToday)
            .accessibilityAddTraits(.isButton)
            .accessibilityAction(.default, open)
    }
}
