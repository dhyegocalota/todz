import SwiftUI
import TodzKit

private let openWindowKey: KeyEquivalent = "0"

struct MenuBarHeader: View {
    let workspace: Workspace
    @Environment(MenuBarPanel.self) private var panel
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        HStack {
            WorkspaceSwitcher(workspace: workspace, isMainWindow: false)
                .help(workspace.name)
            Button(MenuBarCopy.openWindow) {
                panel.openMainWindow(openWindow)
            }
            .buttonStyle(.borderless)
            .foregroundStyle(.secondary)
            .keyboardShortcut(openWindowKey)
            .padding(.trailing)
        }
    }
}
