import SwiftUI
import TodzKit
import WidgetKit

private let titleLineLimit = 3

struct NextUpTask: View {
    let task: WidgetSnapshotTask
    let widgetDay: WidgetDay

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            marker
            VStack(alignment: .leading) {
                Text(task.title)
                    .font(.title3)
                    .fontWeight(.semibold)
                    .lineLimit(titleLineLimit)
                    .truncationMode(.tail)
                if hasCaption {
                    HStack {
                        if let dueLine {
                            Text(dueLine)
                                .foregroundStyle(task.isOverdue ? Color.red : Color.secondary)
                        }
                        if let creatorLabel = task.creatorLabel {
                            Text(TaskRowCopy.via(client: creatorLabel))
                                .foregroundStyle(.secondary)
                        }
                    }
                    .font(.subheadline)
                    .lineLimit(1)
                    .truncationMode(.tail)
                }
                if task.isProjectTagShown {
                    Text(task.projectName)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .background(.fill.quaternary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityHint(AccessibilityCopy.rowOpensWindow)
        }
    }

    @ViewBuilder private var marker: some View {
        switch task.key {
        case let .some(key):
            WidgetCheckbox(task: task, key: key)
                .widgetAccentable()
        case .none:
            PendingMarker()
        }
    }

    private var hasCaption: Bool {
        dueLine != nil || task.creatorLabel != nil
    }

    private var dueLine: String? {
        guard task.key != nil else { return TaskRowCopy.pending }
        return widgetDay.dueText(of: task)
    }
}
