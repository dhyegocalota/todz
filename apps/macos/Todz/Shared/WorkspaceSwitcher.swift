import SwiftUI
import TodzKit

private let shownNamesSeparator = ", "
private let lockedSymbol = "lock.fill"
private let unlockedSymbol = "lock.open.fill"

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

    @ViewBuilder private var switcher: some View {
        let isSoleWorkspaceInPopover = !isMainWindow && model.workspaces.count == 1
        if isSoleWorkspaceInPopover {
            Text(workspace.name)
                .lineLimit(1)
        }
        if !isSoleWorkspaceInPopover {
            menu
        }
    }

    private var menu: some View {
        Menu {
            if !model.workspaceLock.isLocked {
                Toggle(MainWindowCopy.allWorkspaces, isOn: isAllSelected)
                Divider()
            }
            ForEach(model.presentedWorkspaces, id: \.identifier) { presented in
                switch presented {
                case let .visible(candidate):
                    Toggle(candidate.name, isOn: isShown(candidate))
                case let .locked(identifier):
                    Button {
                        Task {
                            await model.switchWorkspace(identifier: identifier)
                            model.announceConfirmationFailure()
                        }
                    } label: {
                        LockedWorkspaceRow()
                    }
                }
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
            HStack {
                Text(shownNames)
                    .lineLimit(1)
                lockIndicator
            }
        }
        .menuStyle(.borderlessButton)
        .fixedSize(horizontal: isMainWindow, vertical: true)
        .accessibilityLabel(AccessibilityCopy.switcher(name: shownNames))
        .accessibilityValue(lockState)
    }

    @ViewBuilder private var lockIndicator: some View {
        if model.workspaceLock.isEnabled {
            Image(systemName: model.workspaceLock.isUnlocked ? unlockedSymbol : lockedSymbol)
                .font(.caption)
                .foregroundStyle(.secondary)
                .help(lockHelp)
                .accessibilityHidden(true)
        }
    }

    private var lockHelp: String {
        model.workspaceLock.isUnlocked ? WorkspaceLockCopy.unlockedHelp(timeout: model.workspaceLock.timeout) : WorkspaceLockCopy.lockedHelp
    }

    private var lockState: String {
        guard model.workspaceLock.isEnabled else { return "" }
        return model.workspaceLock.isUnlocked ? WorkspaceLockCopy.unlockedState : WorkspaceLockCopy.lockedState
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
            Task { await model.toggleWorkspace(identifier: candidate.identifier) }
        }
    }
}
