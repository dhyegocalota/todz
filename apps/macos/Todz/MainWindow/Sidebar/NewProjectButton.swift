import SwiftUI
import TodzKit

private let addSymbol = "plus.circle.fill"

struct NewProjectButton: View {
    let workspace: Workspace
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @State private var isHovering = false

    var body: some View {
        Button {
            windowState.sheet = .newProject
        } label: {
            Label {
                Text(MainWindowCopy.newProjectButton)
                    .foregroundStyle(isHovering ? HierarchicalShapeStyle.primary : .secondary)
            } icon: {
                Image(systemName: addSymbol)
                    .foregroundStyle(Color.accentColor)
            }
            .lineLimit(1)
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(.rect)
        }
        .buttonStyle(.borderless)
        .disabled(!model.isReady)
        .help(MainWindowCopy.newProjectHelp(workspaceName: workspace.name))
        .accessibilityHint(MainWindowCopy.newProjectHelp(workspaceName: workspace.name))
        .onHover { isHovering = $0 }
        .todzAnimation(.snap, value: isHovering)
    }
}
