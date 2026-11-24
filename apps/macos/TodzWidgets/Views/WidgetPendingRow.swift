import SwiftUI
import TodzKit

struct WidgetPendingRow: View {
    let task: WidgetSnapshotTask

    var body: some View {
        HStack {
            PendingMarker()
            Text(task.title)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(task.title)
        .accessibilityValue(TaskRowCopy.pending)
    }
}
