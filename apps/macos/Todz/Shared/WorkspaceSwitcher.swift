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
            Toggle(MainWindowCopy.allWorkspaces, isOn: isAllSelected)
            Divider()
            ForEach(model.workspaces, id: \.identifier) { candidate in
                Toggle(candidate.name, isOn: isShown(candidate))
            }
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
            Task { await model.toggleWorkspace(identifier: candidate.identifier) }
        }
    }
}
