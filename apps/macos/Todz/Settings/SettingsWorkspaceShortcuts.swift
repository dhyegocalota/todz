import SwiftUI
import TodzKit

struct SettingsWorkspaceShortcuts: View {
    @Environment(AppModel.self) private var model
    @Environment(WorkspaceShortcutController.self) private var shortcuts
    @AppStorage(WorkspaceShortcutsPreference.isGlobalOnStorageKey) private var isGlobalOn = WorkspaceShortcutsPreference.isGlobalOnByDefault
    @State private var refusal: RebindRefusal?

    var body: some View {
        if !model.workspaces.isEmpty {
            Section {
                Toggle(isOn: $isGlobalOn) {
                    Text(WorkspaceShortcutsCopy.fromAnyApp)
                    Text(WorkspaceShortcutsCopy.fromAnyAppDetail)
                        .lineLimit(subtitleLines, reservesSpace: true)
                }
                .toggleStyle(.switch)
                .onChange(of: isGlobalOn) { shortcuts.registerHotKeys() }
                WorkspaceChordRow(action: .previous, title: WorkspaceShortcutsCopy.previous, refusal: $refusal)
                WorkspaceChordRow(action: .next, title: WorkspaceShortcutsCopy.next, refusal: $refusal)
                ForEach(WorkspaceShortcuts.numbered(model.workspaces), id: \.workspace.identifier) { number, workspace in
                    WorkspaceChordRow(action: .number(number), title: workspace.name, refusal: $refusal)
                }
                Text(footnote)
                    .foregroundStyle(.secondary)
            } header: {
                Text(WorkspaceShortcutsCopy.header)
            }
        }
    }

    private var footnote: String {
        guard let refusal else { return WorkspaceShortcutsCopy.missionControl }
        return WorkspaceShortcutsCopy.refusal(refusal)
    }
}
