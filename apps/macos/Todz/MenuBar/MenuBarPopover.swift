import SwiftUI
import TodzKit

struct MenuBarPopover: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openWindow) private var openWindow
    @State private var panel = MenuBarPanel()
    @FocusState private var focus: MenuBarFocus?

    var body: some View {
        VStack {
            if let destination = model.addTaskDestination(for: .today) {
                AddTaskField(destination: destination, focus: $focus, focusedValue: .addField) { escape in
                    guard escape == .wasEmpty else { return }
                    panel.close()
                }
            }
            Button(MenuBarCopy.openWindow) {
                panel.close()
                openWindow.mainWindow()
            }
        }
        .padding(.vertical)
        .background(MenuBarPanelReader(panel: panel) { Task { focus = .addField } })
        .task { await model.launch() }
    }
}
