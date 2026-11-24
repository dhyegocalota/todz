import SwiftUI
import TodzKit

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
                .help(workspace.name)
        }
        if !isSoleWorkspaceInPopover {
            menu
        }
    }

    private var menu: some View {
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
            if isMainWindow {
                Divider()
                Button(MainWindowCopy.newWorkspace) {
                    windowState.sheet = .newWorkspace
                }
                Divider()
                Button(MainWindowCopy.signOut) {
                    windowState.requestSignOut(model: model)
                }
            }
        } label: {
            Text(workspace.name)
                .lineLimit(1)
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .accessibilityLabel(AccessibilityCopy.switcher(name: workspace.name))
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
