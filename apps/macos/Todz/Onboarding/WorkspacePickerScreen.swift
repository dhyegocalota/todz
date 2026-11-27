import SwiftUI
import TodzKit

private let columnWidth: CGFloat = 320

struct WorkspacePickerScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @State private var isNamingWorkspace = false

    var body: some View {
        CenteredColumn {
            FormPanel(width: columnWidth) {
                Text(WorkspacePickerCopy.title)
                    .font(.title)
                    .bold()
                Text(WorkspacePickerCopy.body)
                    .foregroundStyle(.secondary)
                ForEach(model.presentedWorkspaces, id: \.identifier) { presented in
                    Button {
                        Task {
                            await model.chooseWorkspace(identifier: presented.identifier)
                            model.announceConfirmationFailure()
                        }
                    } label: {
                        pickerRow(presented)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical)
                    }
                    .buttonStyle(.bordered)
                }
                if let banner = model.banner {
                    Text(banner.title)
                        .foregroundStyle(banner.lineStyle)
                    BannerActionButton()
                }
                FormButton(title: MainWindowCopy.newWorkspace, busyTitle: nil, kind: .quiet, isBusy: false, disabledReason: nil) {
                    isNamingWorkspace = true
                }
                FormButton(title: MainWindowCopy.signOut, busyTitle: nil, kind: .quiet, isBusy: false, disabledReason: nil) {
                    windowState.requestSignOut(model: model)
                }
            }
        }
        .multilineTextAlignment(.center)
        .sheet(isPresented: $isNamingWorkspace) {
            NameSheet(kind: .newWorkspace)
        }
    }

    @ViewBuilder private func pickerRow(_ presented: PresentedWorkspace) -> some View {
        switch presented {
        case let .visible(workspace): WorkspaceSummary(workspace: workspace)
        case .locked: LockedWorkspaceRow()
        }
    }
}
