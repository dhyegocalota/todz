import SwiftUI
import TodzKit

struct TodayDigest: View {
    let openCount: Int
    let subtitle: String?
    let rows: [WidgetSnapshotTask]
    let restCount: Int

    var body: some View {
        VStack(alignment: .leading) {
            HStack {
                Text(MainWindowCopy.today)
                    .font(.headline)
                Text(MenuBarCopy.left(count: openCount))
                    .foregroundStyle(.secondary)
            }
            if let subtitle {
                Text(subtitle)
                    .foregroundStyle(.secondary)
            }
            if openCount == 0 {
                Text(MenuBarCopy.dayClosedBody)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                TodayDigestRow(task: row)
            }
            if restCount > 0 {
                Text(MorningGlanceCopy.more(count: restCount))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private struct TodayDigestRow: View {
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
