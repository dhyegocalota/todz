import SwiftUI
import TodzKit

private let activeSymbol = "checkmark"

struct WorkspaceChooserSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading) {
            Text(WorkspacePickerCopy.title)
                .font(.title3)
                .bold()
            ForEach(model.visibleWorkspaces, id: \.identifier) { workspace in
                row(of: workspace)
            }
            HStack {
                Spacer()
                FormButton(title: SheetCopy.cancel, busyTitle: nil, kind: .cancel, isBusy: false, disabledReason: nil) { dismiss() }
                    .keyboardShortcut(.cancelAction)
            }
        }
        .padding()
        .frame(minWidth: FormMetrics.sheetMinimumWidth)
    }

    private func row(of workspace: Workspace) -> some View {
        let isActive = workspace.identifier == model.activeWorkspace?.identifier
        return Button {
            Task {
                await model.switchWorkspace(identifier: workspace.identifier)
                dismiss()
            }
        } label: {
            HStack {
                WorkspaceSummary(workspace: workspace)
                Spacer()
                if isActive {
                    Image(systemName: activeSymbol)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical)
        }
        .buttonStyle(.bordered)
        .keyboardShortcut(isActive ? .defaultAction : nil)
    }
}
