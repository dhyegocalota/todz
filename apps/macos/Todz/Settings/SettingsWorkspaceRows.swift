import SwiftUI
import TodzKit

private let activeSymbol = "checkmark"
private let actionsSymbol = "ellipsis.circle"

struct SettingsWorkspaceRows: View {
    @Environment(AppModel.self) private var model
    @State private var sheet: NameSheetKind?
    @State private var deletion: DeletionKind?

    var body: some View {
        if !model.workspaces.isEmpty {
            Section {
                ForEach(model.presentedWorkspaces, id: \.identifier) { presented in
                    switch presented {
                    case let .visible(workspace): row(of: workspace)
                    case let .locked(identifier): lockedRow(identifier: identifier)
                    }
                }
            } header: {
                Text(SettingsCopy.workspaces)
            }
            .sheet(item: $sheet) { kind in
                NameSheet(kind: kind)
            }
            .sheet(item: $deletion) { kind in
                DeleteConfirmSheet(kind: kind)
            }
        }
    }

    private func row(of workspace: Workspace) -> some View {
        HStack {
            Button {
                Task { await model.switchWorkspace(identifier: workspace.identifier) }
            } label: {
                LabeledContent {
                    if workspace.identifier == model.activeWorkspace?.identifier {
                        Image(systemName: activeSymbol)
                    }
                } label: {
                    WorkspaceSummary(workspace: workspace)
                }
            }
            .buttonStyle(.plain)
            .disabled(!model.isReady)
            actions(of: workspace)
        }
    }

    private func lockedRow(identifier: String) -> some View {
        Button {
            Task {
                await model.switchWorkspace(identifier: identifier)
                model.announceConfirmationFailure()
            }
        } label: {
            LockedWorkspaceRow()
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
        .disabled(!model.isReady)
    }

    private func actions(of workspace: Workspace) -> some View {
        Menu {
            Button(MainWindowCopy.renameWorkspace) { sheet = .renameWorkspace(workspace) }
            Button(MainWindowCopy.deleteWorkspace) { deletion = .workspace(workspace) }
        } label: {
            Image(systemName: actionsSymbol)
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .disabled(!model.isReady)
        .accessibilityLabel(SettingsCopy.workspaceActions)
    }
}
