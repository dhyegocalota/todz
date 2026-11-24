import SwiftUI
import TodzKit

struct MenuBarTodayBody: View {
    let state: TaskListState
    let maximumHeight: CGFloat

    var body: some View {
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
            VStack {
                Text(MainWindowCopy.todayEmptyTitle)
                    .foregroundStyle(.secondary)
                Text(MainWindowCopy.todayEmptyBody)
                    .font(.subheadline)
            }
            .frame(maxWidth: .infinity)
            .padding()
        case let .rows(sections):
            MenuBarTodayRows(sections: sections, maximumHeight: maximumHeight)
        }
    }
}
