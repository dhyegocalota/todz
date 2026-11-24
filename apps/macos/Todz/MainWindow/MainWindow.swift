import SwiftUI
import TodzKit

private let sidebarMinimumWidth: CGFloat = 180
private let sidebarIdealWidth: CGFloat = 224
private let sidebarMaximumWidth: CGFloat = 300
private let listMinimumWidth: CGFloat = 320
private let inspectorMinimumWidth: CGFloat = 260
private let inspectorIdealWidth: CGFloat = 320
private let inspectorMaximumWidth: CGFloat = 420
private let windowMinimumHeight: CGFloat = 480

struct MainWindow: View {
    let workspace: Workspace
    @Environment(MainWindowState.self) private var windowState
    @FocusState private var focus: MainWindowFocus?
    @State private var sidebarInset: CGFloat = .zero
    @State private var inspectorWidth: CGFloat = .zero
    @State private var toolbarHeight: CGFloat = .zero

    var body: some View {
        @Bindable var windowState = windowState
        NavigationSplitView {
            SidebarView(workspace: workspace)
                .navigationSplitViewColumnWidth(min: sidebarMinimumWidth, ideal: sidebarIdealWidth, max: sidebarMaximumWidth)
        } detail: {
            TaskListView(workspace: workspace, focus: $focus)
                .onGeometryChange(for: CGFloat.self, of: \.safeAreaInsets.leading) { sidebarInset = $0 }
                .inspector(isPresented: $windowState.isInspectorPresented) {
                    InspectorView(focus: $focus)
                        .inspectorColumnWidth(min: inspectorMinimumWidth, ideal: inspectorIdealWidth, max: inspectorMaximumWidth)
                        .onGeometryChange(for: CGFloat.self, of: \.size.width) { inspectorWidth = $0 }
                }
        }
        .frame(minWidth: minimumWidth, minHeight: windowMinimumHeight - toolbarHeight)
        .onGeometryChange(for: CGFloat.self, of: \.safeAreaInsets.top) { toolbarHeight = $0 }
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

    private var minimumWidth: CGFloat {
        guard windowState.isInspectorPresented else { return sidebarInset + listMinimumWidth }
        return sidebarInset + listMinimumWidth + inspectorWidth
    }
}
