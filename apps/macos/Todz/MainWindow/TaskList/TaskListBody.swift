import SwiftUI
import TodzKit

struct TaskListBody: View {
    let state: TaskListState
    let item: SidebarItem
    let arriving: Set<RowIdentity>
    let focus: FocusState<MainWindowFocus?>.Binding

    var body: some View {
        switch state {
        case .loading:
            ProgressView(MainWindowCopy.loading)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case let .failed(loadFailure):
            FailureView(banner: loadFailure)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .empty:
            ContentUnavailableView(item.emptyTitle, systemImage: item.symbol, description: Text(item.emptyBody))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case let .rows(sections):
            TaskRows(sections: sections, item: item, arriving: arriving, focus: focus)
        }
    }
}
