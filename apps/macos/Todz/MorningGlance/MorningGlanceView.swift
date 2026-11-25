import SwiftUI
import TodzKit

let morningGlanceWidth: CGFloat = 280
private let cornerRadius: CGFloat = 18

struct MorningGlanceView: View {
    let content: MorningGlanceContent
    let open: () -> Void

    var body: some View {
        VStack(alignment: .leading) {
            HStack {
                Text(MainWindowCopy.today)
                    .font(.headline)
                Text(MenuBarCopy.left(count: content.openCount))
                    .foregroundStyle(.secondary)
            }
            ForEach(Array(content.rows.enumerated()), id: \.offset) { _, row in
                MorningGlanceRow(task: row)
            }
            if content.restCount > 0 {
                Text(MorningGlanceCopy.more(count: content.restCount))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(width: morningGlanceWidth, alignment: .leading)
        .modifier(MorningGlanceSurface())
        .help(MorningGlanceCopy.openToday)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(AccessibilityCopy.morningGlance(count: content.openCount))
        .accessibilityValue(content.rows.map(\.title).joined(separator: ", "))
        .accessibilityHint(AccessibilityCopy.glanceOpensToday)
        .accessibilityAddTraits(.isButton)
        .accessibilityAction(.default, open)
    }
}

private struct MorningGlanceRow: View {
    let task: WidgetSnapshotTask

    var body: some View {
        HStack {
            Image(systemName: "circle")
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            Text(task.title)
                .lineLimit(1)
                .truncationMode(.tail)
            if task.isOverdue {
                Spacer()
                Text(MorningGlanceCopy.overdue)
                    .foregroundStyle(.red)
            }
        }
    }
}

private struct MorningGlanceSurface: ViewModifier {
    func body(content: Content) -> some View {
        if #available(macOS 26.0, *) {
            content.glassEffect(.regular, in: .rect(cornerRadius: cornerRadius))
        } else {
            content.background(.regularMaterial, in: RoundedRectangle(cornerRadius: cornerRadius))
        }
    }
}
