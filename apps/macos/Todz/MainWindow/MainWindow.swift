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
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @FocusState private var focus: MainWindowFocus?
    @State private var titleFlightFrames = TitleFlightFrames()

    var body: some View {
        @Bindable var windowState = windowState
        ZStack {
            Color.clear
                .frame(minWidth: minimumContentWidth, minHeight: contentMinimumHeight)
            NavigationSplitView {
                SidebarView(workspace: workspace)
                    .navigationSplitViewColumnWidth(min: sidebarMinimumWidth, ideal: sidebarIdealWidth, max: sidebarMaximumWidth)
            } detail: {
                if isOnKeyScreen {
                    KeyScreen(workspace: workspace)
                }
                if !isOnKeyScreen {
                    TaskListView(workspace: workspace, item: model.selectedItem, focus: $focus)
                        .inspector(isPresented: $windowState.isInspectorPresented) {
                            InspectorView(item: model.selectedItem, focus: $focus)
                                .inspectorColumnWidth(min: inspectorMinimumWidth, ideal: inspectorIdealWidth, max: inspectorMaximumWidth)
                        }
                }
            }
        }
        .coordinateSpace(.named(titleFlightSpace))
        .environment(titleFlightFrames)
        .defaultFocus($focus, MainWindowFocus(windowState.openingFocus))
        .onDisappear { windowState.windowClosed() }
        .sheet(item: $windowState.sheet) { kind in
            NameSheet(kind: kind)
        }
        .sheet(isPresented: $windowState.isChoosingWorkspace) {
            WorkspaceChooserSheet()
        }
        .sheet(item: $windowState.deletion) { kind in
            DeleteConfirmSheet(kind: kind)
        }
        .onChange(of: windowState.focusRequest) { _, request in
            guard let request else { return }
            windowState.focusRequest = nil
            Task { focus = request }
        }
    }

    private var isOnKeyScreen: Bool {
        model.selectedItem == .connectAgent
    }

    private var minimumContentWidth: CGFloat {
        let isInspectorShown = windowState.isInspectorPresented && !isOnKeyScreen
        guard isInspectorShown else { return listMinimumWidth }
        return listMinimumWidth + inspectorIdealWidth
    }
}
