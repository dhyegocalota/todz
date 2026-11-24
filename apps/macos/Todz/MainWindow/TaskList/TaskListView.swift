import SwiftUI
import TodzKit

struct TaskListView: View {
    let workspace: Workspace
    let focus: FocusState<MainWindowFocus?>.Binding
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState

    var body: some View {
        let state = TaskListState.of(workspace: workspace, model: model, lingers: windowState.lingers)
        VStack(alignment: .leading, spacing: .zero) {
            TaskListHeader(workspace: workspace)
            if let banner = model.banner, !state.isFailed {
                ErrorBanner(banner: banner)
            }
            if let destination = model.addTaskDestination(for: model.selectedItem), !state.isFailed {
                AddTaskField(destination: destination, focus: focus)
                    .id(destination)
            }
            TaskListBody(state: state, item: model.selectedItem, focus: focus)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color(nsColor: .windowBackgroundColor))
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                SyncStatusItem()
                RefreshButton()
                InspectorToggle()
            }
        }
    }
}
