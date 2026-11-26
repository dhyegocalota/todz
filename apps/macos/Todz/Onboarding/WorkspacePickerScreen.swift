import SwiftUI
import TodzKit

private let columnWidth: CGFloat = 320

struct WorkspacePickerScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @State private var isNamingWorkspace = false

    var body: some View {
        CenteredColumn(width: columnWidth) {
            Text(WorkspacePickerCopy.title)
                .font(.title)
                .bold()
            Text(WorkspacePickerCopy.body)
                .foregroundStyle(.secondary)
            ForEach(model.workspaces, id: \.identifier) { workspace in
                Button {
                    Task { await model.chooseWorkspace(identifier: workspace.identifier) }
                } label: {
                    WorkspaceSummary(workspace: workspace)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 4)
                }
                .buttonStyle(.bordered)
            }
            if let banner = model.banner {
                Text(banner.title)
                    .foregroundStyle(.red)
                BannerActionButton()
            }
            Button(MainWindowCopy.newWorkspace) {
                isNamingWorkspace = true
            }
            .buttonStyle(.link)
            Button(MainWindowCopy.signOut) {
                windowState.requestSignOut(model: model)
            }
            .buttonStyle(.link)
        }
        .multilineTextAlignment(.center)
        .sheet(isPresented: $isNamingWorkspace) {
            NameSheet(kind: .newWorkspace)
        }
    }
}
