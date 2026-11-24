import SwiftUI
import TodzKit
import WidgetKit

struct TodayListView: View {
    let entry: TodayEntry
    @Environment(\.widgetFamily) private var widgetFamily

    var body: some View {
        switch (entry.content(of: family), entry.widgetDay) {
        case let (.today(today), .some(widgetDay)):
            VStack(alignment: .leading) {
                header(workspaceName: today.workspaceName, openCount: today.openCount)
                ForEach(Array(today.rows.enumerated()), id: \.offset) { index, row in
                    if index > .zero {
                        Divider()
                    }
                    rowView(row, widgetDay: widgetDay)
                }
                Spacer()
            }
        case let (.empty(workspaceName), _):
            VStack(alignment: .leading) {
                header(workspaceName: workspaceName, openCount: nil)
                WidgetEmptyToday()
            }
        default:
            WidgetPrompt(title: MainWindowCopy.today)
        }
    }

    private var family: WidgetFamilyKind {
        widgetFamily == .systemLarge ? .large : .medium
    }

    private func header(workspaceName: String, openCount: Int?) -> WidgetHeader {
        let isLarge = family == .large
        return WidgetHeader(
            title: isLarge ? workspaceName : MainWindowCopy.today,
            spokenTitle: isLarge ? workspaceName : AccessibilityCopy.todayIn(workspace: workspaceName),
            openCount: openCount
        )
    }

    @ViewBuilder private func rowView(_ row: WidgetSnapshotTask, widgetDay: WidgetDay) -> some View {
        switch row.key {
        case let .some(key):
            WidgetTaskRow(task: row, key: key, showsTag: family == .large, widgetDay: widgetDay)
        case .none:
            WidgetPendingRow(task: row)
        }
    }
}
