import SwiftUI
import TodzKit

private let maximumPopoverHeight: CGFloat = 520
private let newTaskKey: KeyEquivalent = "n"

struct MenuBarToday: View {
    let workspace: Workspace
    let focus: FocusState<MenuBarFocus?>.Binding
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @Environment(MenuBarPanel.self) private var panel
    @State private var pinnedTopHeight: CGFloat = .zero
    @State private var footHeight: CGFloat = .zero

    var body: some View {
        let state = TaskListState.of(workspace: workspace, item: .today, model: model, lingers: windowState.lingers)
        let destination = model.addTaskDestination(for: .today)
        VStack(alignment: .leading, spacing: .zero) {
            VStack(alignment: .leading, spacing: .zero) {
                MenuBarHeader(workspace: workspace)
                if let banner = model.banner, !state.isFailed {
                    ErrorBanner(banner: banner)
                }
                if let destination, !state.isFailed {
                    AddTaskField(destination: destination, selection: .keepSelection, focus: focus, focusedValue: .addField, onEscape: closeWhenEmpty)
                }
                if case .rows = state, let taskViews = model.taskViews {
                    MenuBarTodayHeading(openCount: taskViews.today.open.count)
                }
            }
            .onGeometryChange(for: CGFloat.self, of: \.size.height) { pinnedTopHeight = $0 }
            MenuBarTodayBody(state: state, maximumHeight: maximumPopoverHeight - pinnedTopHeight - footHeight)
            MenuBarFoot(doneCount: doneCount(state: state))
                .onGeometryChange(for: CGFloat.self, of: \.size.height) { footHeight = $0 }
        }
        .background {
            Button(MainWindowCopy.newTask) { focus.wrappedValue = .addField }
                .keyboardShortcut(newTaskKey)
                .hidden()
        }
    }

    private func closeWhenEmpty(_ escape: AddTaskFieldEscape) {
        guard escape == .wasEmpty else { return }
        panel.close()
    }

    private func doneCount(state: TaskListState) -> Int {
        guard case .rows = state, let taskViews = model.taskViews else { return .zero }
        return taskViews.today.doneToday.count
    }
}
