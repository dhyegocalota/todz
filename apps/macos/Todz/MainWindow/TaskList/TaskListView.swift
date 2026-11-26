import SwiftUI
import TodzKit

struct TaskListView: View {
    let workspace: Workspace
    let item: SidebarItem
    let focus: FocusState<MainWindowFocus?>.Binding
    let titleNamespace: Namespace.ID
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState

    var body: some View {
        let state = TaskListState.of(workspace: workspace, item: item, model: model, lingers: windowState.lingers)
        VStack(alignment: .leading, spacing: .zero) {
            TaskListHeader(workspace: workspace, item: item, titleNamespace: titleNamespace)
            if let banner = model.banner, !state.isFailed {
                ErrorBanner(banner: banner)
            }
            if let destination = model.addTaskDestination(for: item), !state.isFailed {
                AddTaskField(destination: destination, selection: .selectWhenSaved, focus: focus, focusedValue: .addField) { _ in
                    focus.wrappedValue = .list
                }
                .disabled(!windowState.addFieldArming.isArmed)
                .overlay {
                    if !windowState.addFieldArming.isArmed {
                        Color.clear
                            .contentShape(Rectangle())
                            .onTapGesture { arm() }
                    }
                }
                .id(destination)
            }
            TaskListBody(state: state, item: item, focus: focus)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color(nsColor: .windowBackgroundColor))
        .onChange(of: windowState.addFieldArming.isArmed) { _, isArmed in
            guard isArmed else { return }
            Task { focus.wrappedValue = .addField }
        }
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                SyncStatusItem(announcesChanges: true)
                RefreshButton()
                InspectorToggle()
            }
        }
    }

    private func arm() {
        windowState.addFieldArming.apply(.addFieldClicked)
    }
}
