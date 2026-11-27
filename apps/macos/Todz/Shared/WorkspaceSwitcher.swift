import SwiftUI
import TodzKit

private let shownNamesSeparator = ", "

struct WorkspaceSwitcher: View {
    let workspace: Workspace
    let isMainWindow: Bool
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState

    var body: some View {
        switcher
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
    }

    private var chrome: WorkspaceChrome {
        WorkspaceChrome(visible: model.visibleWorkspaces, selection: model.selection, isMainWindow: isMainWindow, isSingleSelection: model.workspaceLock.isEnabled)
    }

    @ViewBuilder private var switcher: some View {
        if chrome.switcher == .plainName {
            Text(workspace.name)
                .lineLimit(1)
        }
        if chrome.switcher == .menu {
            menu
        }
    }

    private var menu: some View {
        Menu {
            if chrome.showsAllWorkspaces {
                Toggle(MainWindowCopy.allWorkspaces, isOn: isAllSelected)
                Divider()
            }
            ForEach(chrome.rows, id: \.workspace.identifier) { row in
                Toggle(row.workspace.name, isOn: isShown(row.workspace))
            }
            if model.workspaceLock.isUnlocked {
                Button(WorkspaceLockCopy.lockNow) {
                    Task { await model.relockWorkspaces(because: .manual) }
                }
            }
            if isMainWindow {
                Divider()
                Button(MainWindowCopy.newWorkspace) {
                    windowState.sheet = .newWorkspace
                }
                Button(MainWindowCopy.renameWorkspace) {
                    windowState.sheet = .renameWorkspace(workspace)
                }
                Button(MainWindowCopy.deleteWorkspace) {
                    windowState.deletion = .workspace(workspace)
                }
                Divider()
                Button(MainWindowCopy.signOut) {
                    windowState.requestSignOut(model: model)
                }
            }
        } label: {
            Text(shownNames)
                .lineLimit(1)
        }
        .menuStyle(.borderlessButton)
        .fixedSize(horizontal: isMainWindow, vertical: true)
        .accessibilityLabel(AccessibilityCopy.switcher(name: shownNames))
    }

    private var shownNames: String {
        guard model.selection != .all else { return MainWindowCopy.allWorkspaces }
        return model.shownWorkspaces.map(\.name).joined(separator: shownNamesSeparator)
    }

    private var isAllSelected: Binding<Bool> {
        Binding {
            model.selection == .all
        } set: { isOn in
            guard isOn else { return }
            Task { await model.selectWorkspaces(.all) }
        }
    }

    private func isShown(_ candidate: Workspace) -> Binding<Bool> {
        Binding {
            model.shownWorkspaces.contains { $0.identifier == candidate.identifier }
        } set: { _ in
            Task { await model.pickWorkspace(identifier: candidate.identifier, gesture: .click) }
        }
    }
}
