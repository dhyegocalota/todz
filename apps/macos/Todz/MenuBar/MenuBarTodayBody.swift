import SwiftUI
import TodzKit

struct MenuBarTodayBody: View {
    let state: TaskListState
    let day: MenuBarDay
    let focus: FocusState<MenuBarFocus?>.Binding
    let navigate: (MenuBarDirection) -> Void
    let maximumHeight: CGFloat

    var body: some View {
        switch day.screen {
        case .loading:
            MenuBarSkeleton()
        case .failed:
            failure
        case .dayClosed:
            centeredLines(title: MenuBarCopy.dayClosedTitle, detail: MenuBarCopy.dayClosedBody)
        case .empty:
            centeredLines(title: MainWindowCopy.todayEmptyTitle, detail: MainWindowCopy.todayEmptyBody)
        case .closingDay, .allDone, .active:
            MenuBarTodayRows(day: day, pendingTasks: pendingTasks, focus: focus, navigate: navigate, maximumHeight: maximumHeight)
        }
    }

    @ViewBuilder private var failure: some View {
        if case let .failed(loadFailure) = state {
            FailureView(banner: loadFailure)
                .padding(.vertical)
        }
    }

    private var pendingTasks: [PendingTask] {
        guard case let .rows(sections) = state else { return [] }
        return sections.flatMap(\.pendingTasks)
    }

    private func centeredLines(title: String, detail: String) -> some View {
        VStack {
            Text(title)
            Text(detail)
                .font(.subheadline)
        }
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity)
        .padding()
    }
}
