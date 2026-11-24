import SwiftUI
import TodzKit

private let newKey: KeyEquivalent = "n"
private let refreshKey: KeyEquivalent = "r"
private let inspectorKey: KeyEquivalent = "i"

struct AppCommands: Commands {
    let model: AppModel
    let windowState: MainWindowState

    var body: some Commands {
        SidebarCommands()
        CommandGroup(after: .appInfo) {
            Divider()
            Button(MainWindowCopy.signOut) {
                Task { await model.signOut() }
            }
            .disabled(!model.isSignedIn)
        }
        CommandGroup(replacing: .newItem) {
            Button(MainWindowCopy.newTask) { windowState.requestNewTask(model: model) }
                .keyboardShortcut(newKey)
                .disabled(!model.isReady)
            Button(MainWindowCopy.newProject) { windowState.sheet = .newProject }
                .keyboardShortcut(newKey, modifiers: [.command, .shift])
                .disabled(!model.isReady)
            Button(MainWindowCopy.newWorkspace) { windowState.sheet = .newWorkspace }
                .disabled(!model.isReady)
        }
        CommandGroup(after: .sidebar) {
            Button(MainWindowCopy.refresh) {
                Task { await model.refresh() }
            }
            .keyboardShortcut(refreshKey)
            .disabled(!model.isReady || model.isRefreshing)
            Button(windowState.inspectorToggleTitle) { windowState.isInspectorPresented.toggle() }
                .keyboardShortcut(inspectorKey, modifiers: [.command, .option])
                .disabled(!model.isReady)
        }
        CommandMenu(MainWindowCopy.taskMenu) {
            TaskMenuItems(model: model)
        }
    }
}
