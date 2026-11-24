import SwiftUI
import TodzKit
import WidgetKit

struct NextUpView: View {
    let entry: TodayEntry

    var body: some View {
        content
            .widgetURL(link.url)
    }

    @ViewBuilder private var content: some View {
        switch (entry.content(of: .small), entry.widgetDay) {
        case let (.today(today), .some(widgetDay)):
            labeled { todayBody(today, widgetDay: widgetDay) }
        case (.empty, _):
            labeled {
                Text(MainWindowCopy.todayEmptyTitle)
                    .foregroundStyle(.secondary)
            }
        default:
            WidgetPrompt(title: WidgetCopy.nextUp)
        }
    }

    private var link: WidgetLink {
        guard case let .today(today) = entry.content(of: .small), let key = today.nextUp?.key else { return .today }
        return .task(key)
    }

    private func labeled(@ViewBuilder _ body: () -> some View) -> some View {
        VStack(alignment: .leading) {
            Text(WidgetCopy.nextUp)
                .font(.headline)
                .unredacted()
                .accessibilityAddTraits(.isHeader)
            body()
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder private func todayBody(_ today: WidgetToday, widgetDay: WidgetDay) -> some View {
        switch today.nextUp {
        case let .some(task):
            NextUpTask(task: task, widgetDay: widgetDay)
        case .none:
            Text(WidgetCopy.allDone)
                .foregroundStyle(.secondary)
            Text(MenuBarCopy.doneToday(count: today.doneCount))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .contentTransition(.numericText())
                .invalidatableContent()
        }
    }
}
