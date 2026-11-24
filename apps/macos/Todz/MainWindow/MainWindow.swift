import SwiftUI
import TodzKit

private let sidebarMinimumWidth: CGFloat = 180
private let sidebarIdealWidth: CGFloat = 224
private let sidebarMaximumWidth: CGFloat = 300
private let listMinimumWidth: CGFloat = 320
private let inspectorMinimumWidth: CGFloat = 260
private let inspectorIdealWidth: CGFloat = 320
private let inspectorMaximumWidth: CGFloat = 420
private let contentMinimumHeight: CGFloat = 480

struct MainWindow: View {
    let workspace: Workspace
    @Environment(MainWindowState.self) private var windowState
    @FocusState private var focus: MainWindowFocus?

    var body: some View {
        @Bindable var windowState = windowState
        ZStack {
            Color.clear
                .frame(minWidth: minimumContentWidth, minHeight: contentMinimumHeight)
            NavigationSplitView {
                SidebarView(workspace: workspace)
                    .navigationSplitViewColumnWidth(min: sidebarMinimumWidth, ideal: sidebarIdealWidth, max: sidebarMaximumWidth)
            } detail: {
                TaskListView(workspace: workspace, focus: $focus)
                    .inspector(isPresented: $windowState.isInspectorPresented) {
                        InspectorView(focus: $focus)
                            .inspectorColumnWidth(min: inspectorMinimumWidth, ideal: inspectorIdealWidth, max: inspectorMaximumWidth)
                    }
            }
        }
        .task { windowState.focusRequest = .addField }
        .sheet(item: $windowState.sheet) { kind in
            NameSheet(kind: kind)
        }
        .onChange(of: windowState.focusRequest) { _, request in
            guard let request else { return }
            windowState.focusRequest = nil
            Task { focus = request }
        }
    }

    private var minimumContentWidth: CGFloat {
        guard windowState.isInspectorPresented else { return listMinimumWidth }
        return listMinimumWidth + inspectorIdealWidth
    }
}
