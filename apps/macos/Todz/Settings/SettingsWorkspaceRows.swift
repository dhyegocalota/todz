import SwiftUI
import TodzKit

private let activeSymbol = "checkmark"
private let actionsSymbol = "ellipsis.circle"

struct SettingsWorkspaceRows: View {
    @Environment(AppModel.self) private var model
    @State private var sheet: NameSheetKind?
    @State private var deletion: DeletionKind?

    var body: some View {
        if !model.visibleWorkspaces.isEmpty {
            Section {
                ForEach(model.visibleWorkspaces, id: \.identifier) { workspace in
                    row(of: workspace)
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
