import SwiftUI
import TodzKit

struct MenuBarTodayBody: View {
    let state: TaskListState
    let isDayClosed: Bool
    let maximumHeight: CGFloat

    var body: some View {
        if isDayClosed {
            centeredLines(title: MenuBarCopy.dayClosedTitle, detail: MenuBarCopy.dayClosedBody)
        }
        if !isDayClosed {
            stateBody
        }
    }

    @ViewBuilder private var stateBody: some View {
        switch state {
        case .loading:
            ProgressView(MainWindowCopy.loading)
                .controlSize(.small)
                .frame(maxWidth: .infinity)
                .padding()
        case let .failed(loadFailure):
            FailureView(banner: loadFailure)
                .padding(.vertical)
        case .empty:
            centeredLines(title: MainWindowCopy.todayEmptyTitle, detail: MainWindowCopy.todayEmptyBody)
        case let .rows(sections):
            MenuBarTodayRows(sections: sections, maximumHeight: maximumHeight)
        }
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
