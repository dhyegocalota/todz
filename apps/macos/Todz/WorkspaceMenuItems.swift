import SwiftUI
import TodzKit

struct WorkspaceMenuItems: View {
    let model: AppModel
    let shortcuts: WorkspaceShortcutController
    let windowState: MainWindowState

    var body: some View {
        ForEach(WorkspaceShortcuts.numbered(model.presentedWorkspaces), id: \.presented.identifier) { number, presented in
            Button {
                Task {
                    await model.switchWorkspace(number: number)
                    model.announceConfirmationFailure()
                }
            } label: {
                PresentedWorkspaceLabel(presented: presented)
            }
            .keyboardShortcut(WorkspaceShortcuts.keyboardShortcut(number: number))
            .disabled(!model.isReady)
        }
        if model.workspaceLock.isUnlocked {
            Button(WorkspaceLockCopy.lockNow) {
                Task { await model.relockWorkspaces(because: .manual) }
            }
        }
        Divider()
        Menu(WorkspaceShortcutsCopy.chordsMenu) {
            ForEach(WorkspaceShortcuts.numbered(model.presentedWorkspaces), id: \.presented.identifier) { number, presented in
                Button {
                    Task { await model.switchWorkspace(action: .number(number)) }
                } label: {
                    PresentedWorkspaceLabel(presented: presented)
                }
                .keyboardShortcut(shortcuts.shortcut(for: .number(number)))
                .disabled(!model.isReady)
            }
        }
        Button(WorkspaceShortcutsCopy.previous) {
            Task { await model.switchWorkspace(action: .previous) }
        }
        .keyboardShortcut(shortcuts.shortcut(for: .previous))
        .disabled(!canStep)
        Button(WorkspaceShortcutsCopy.next) {
            Task { await model.switchWorkspace(action: .next) }
        }
        .keyboardShortcut(shortcuts.shortcut(for: .next))
        .disabled(!canStep)
        Divider()
        Button(MainWindowCopy.renameWorkspace) {
            if let workspace = model.activeWorkspace { windowState.sheet = .renameWorkspace(workspace) }
        }
        .disabled(!model.isReady)
        Button(MainWindowCopy.deleteWorkspace) {
            if let workspace = model.activeWorkspace { windowState.deletion = .workspace(workspace) }
        }
        .disabled(!model.isReady)
    }

    private var canStep: Bool {
        model.isReady && model.workspaces.count > 1
    }
}
