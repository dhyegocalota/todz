import SwiftUI
import TodzKit

private let activeSymbol = "checkmark"

struct SettingsWorkspaceRows: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if !model.workspaces.isEmpty {
            Section {
                ForEach(model.workspaces, id: \.identifier) { workspace in
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
                }
            } header: {
                Text(SettingsCopy.workspaces)
            }
        }
    }
}
