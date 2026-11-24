import SwiftUI
import TodzKit

struct MenuBarRow: View {
    let task: BoardTask
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @Environment(MenuBarPanel.self) private var panel
    @Environment(\.openWindow) private var openWindow
    @State private var isHovered = false

    var body: some View {
        TaskRow(task: task, item: .today)
            .padding(.horizontal)
            .contentShape(Rectangle())
            .background {
                if isHovered {
                    Rectangle()
                        .fill(.fill.quaternary)
                }
            }
            .onHover { isHovered = $0 }
            .onTapGesture(perform: reveal)
            .accessibilityHint(AccessibilityCopy.rowOpensWindow)
            .accessibilityAction(.default, reveal)
    }

    private func reveal() {
        model.reveal(task: task.key)
        windowState.isInspectorPresented = true
        panel.openMainWindow(openWindow)
    }
}
