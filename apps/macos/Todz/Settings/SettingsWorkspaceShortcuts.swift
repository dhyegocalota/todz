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
                SettingsRow(title: WorkspaceShortcutsCopy.fromAnyApp, detail: WorkspaceShortcutsCopy.fromAnyAppDetail(modifiers: WorkspaceShortcuts.globalModifiers.symbols, numbers: WorkspaceShortcuts.numbers)) {
                    Toggle(WorkspaceShortcutsCopy.fromAnyApp, isOn: $isGlobalOn)
                        .toggleStyle(.switch)
                        .labelsHidden()
                }
                .onChange(of: isGlobalOn) { shortcuts.registerHotKeys() }
                if isGlobalOn {
                    ForEach(WorkspaceShortcuts.numbered(model.presentedWorkspaces), id: \.presented.identifier) { number, presented in
                        WorkspaceChordRow(action: .number(number), title: title(of: presented), refusal: $refusal)
                    }
                }
                ValidationLine(text: footnote, tone: refusal == nil ? .note : .issue)
            } header: {
                Text(WorkspaceShortcutsCopy.header)
            }
        }
    }

    private func title(of presented: PresentedWorkspace) -> String {
        switch presented {
        case let .visible(workspace): workspace.name
        case .locked: WorkspaceLockCopy.lockedWorkspace
        }
    }

    private var footnote: String {
        guard let refusal else { return WorkspaceShortcutsCopy.missionControl }
        return WorkspaceShortcutsCopy.refusal(refusal)
    }
}
