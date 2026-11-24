import SwiftUI
import TodzKit

struct WorkspaceMenuItems: View {
    let model: AppModel

    var body: some View {
        ForEach(WorkspaceShortcuts.numbered(model.workspaces), id: \.workspace.identifier) { number, workspace in
            Button(workspace.name) {
                Task { await model.switchWorkspace(number: number) }
            }
            .keyboardShortcut(WorkspaceShortcuts.keyboardShortcut(number: number))
            .disabled(!model.isReady)
        }
    }
}
