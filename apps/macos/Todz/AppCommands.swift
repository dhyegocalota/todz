import SwiftUI
import TodzKit

private let newKey: KeyEquivalent = "n"
private let refreshKey: KeyEquivalent = "r"
private let inspectorKey: KeyEquivalent = "i"

struct AppCommands: Commands {
    let model: AppModel
    let windowState: MainWindowState
    let updater: AppUpdater?
    let shortcuts: WorkspaceShortcutController
    let languageModel: LanguageModel

    var body: some Commands {
        let _ = languageModel.language
        SidebarCommands()
        CommandGroup(after: .appInfo) {
            if let updater {
                Button(UpdateCopy.checkForUpdates) { updater.checkForUpdates() }
                    .disabled(!updater.canCheckForUpdates)
            }
            StarRepositoryButton()
            Divider()
            Button(MainWindowCopy.signOut) { windowState.requestSignOut(model: model) }
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
                .disabled(!canToggleInspector)
            Divider()
            WorkspaceMenuItems(model: model, shortcuts: shortcuts, windowState: windowState)
        }
        CommandMenu(MainWindowCopy.taskMenu) {
            TaskMenuItems(model: model, windowState: windowState)
        }
    }

    private var canToggleInspector: Bool {
        model.isReady && model.selectedItem != .connectAgent
    }
}
