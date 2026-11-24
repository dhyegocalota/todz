import SwiftUI
import TodzKit

struct WorkspaceSwitcher: View {
    let workspace: Workspace
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState

    var body: some View {
        Menu {
            Picker(selection: activeIdentifier) {
                ForEach(model.workspaces, id: \.identifier) { candidate in
                    Text(candidate.name)
                        .tag(candidate.identifier)
                }
            } label: {
                EmptyView()
            }
            .pickerStyle(.inline)
            Divider()
            Button(MainWindowCopy.newWorkspace) {
                windowState.sheet = .newWorkspace
            }
            Divider()
            Button(MainWindowCopy.signOut) {
                windowState.requestSignOut(model: model)
            }
        } label: {
            Text(workspace.name)
                .lineLimit(1)
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .accessibilityLabel(AccessibilityCopy.switcher(name: workspace.name))
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
    }

    private var activeIdentifier: Binding<String> {
        Binding {
            workspace.identifier
        } set: { identifier in
            guard identifier != workspace.identifier else { return }
            Task { await model.switchWorkspace(identifier: identifier) }
        }
    }
}
